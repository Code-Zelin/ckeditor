/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import AbbreviationCommand from './commend';
import { uid } from 'ckeditor5/src/utils';

/**
 * A converter that blocks partial mention from being converted.
 *
 * This converter is registered with 'highest' priority in order to consume mention attribute before it is converted by
 * any other converters. This converter only consumes partial mention - those whose `_text` attribute is not equal to text with mention
 * attribute. This may happen when copying part of mention text.
 * 
 * 阻止部分提及被转换的转换器。
 *
 * 此转换器以“最高”优先级注册，以便在被转换之前使用提及属性任何其他转换器。
 * 此转换器仅使用部分提及—其' _text '属性不等于带有提及的文本属性。在复制部分提及文本时可能会发生这种情况。
 */
function preventPartialMentionDowncast(dispatcher) {
	dispatcher.on('attribute:wiki', (evt, data, conversionApi) => {
		const mention = data.attributeNewValue;
		console.log("attribute:wiki....", data, mention, data.item.is('$textProxy'));
		if (!data.item.is('$textProxy') || !mention) {
			return;
		}
		const start = data.range.start;
		const textNode = start.textNode || start.nodeAfter;
		console.log("比较 textNode.data, mention._text", textNode.data, mention._text)
		if (textNode.data != mention._text) {
			// Consume item to prevent partial mention conversion.
			console.log('不等于。。。', data.item, evt);
			conversionApi.consumable.consume(data.item, evt.name);
		}
	}, { priority: 'highest' });
}

/**
 * Checks if a node has a correct wiki attribute if present.
 * Returns `true` if the node is text and has a wiki attribute whose text does not match the expected wiki text.
 * 
 * 检查节点是否有正确的提及属性(如果存在)。
 * 如果节点是文本且提及属性的文本与预期提及文本不匹配，则返回' true '。
 */
function isBrokenMentionNode(node) {
	if (!node || !(node.is('$text') || node.is('$textProxy')) || !node.hasAttribute('wiki')) {
		return false;
	}
	const text = node.data;
	const wiki = node.getAttribute('wiki');
	const expectedText = wiki._text;
	return text != expectedText;
}
/**
 * Fixes a wiki on a text node if it needs a fix.
 * 
 * 修复需要修复的文本节点上的提及。
 */
function checkAndFix(textNode, writer) {
	if (isBrokenMentionNode(textNode)) {
		writer.removeAttribute('wiki', textNode);
		return true;
	}
	return false;
}
/**
 * Model post-fixer that removes the wiki attribute from the modified text node.
 * 从修改的文本节点中删除提及属性的模型后置修复器。
 */
function removePartialMentionPostFixer(writer, doc, schema) {
	const changes = doc.differ.getChanges();
	let wasChanged = false;
	for (const change of changes) {
		if (change.type == 'attribute') {
			continue;
		}
		// Checks the text node on the current position.
		// 检查当前位置上的文本节点。
		const position = change.position;
		if (change.name == '$text') {
			const nodeAfterInsertedTextNode = position.textNode && position.textNode.nextSibling;
			// Checks the text node where the change occurred.
			// 检查发生更改的文本节点。
			wasChanged = checkAndFix(position.textNode, writer) || wasChanged;
			// Occurs on paste inside a text node with wiki.
			// 在带有提及的文本节点内粘贴时发生。
			wasChanged = checkAndFix(nodeAfterInsertedTextNode, writer) || wasChanged;
			wasChanged = checkAndFix(position.nodeBefore, writer) || wasChanged;
			wasChanged = checkAndFix(position.nodeAfter, writer) || wasChanged;
		}
		// Checks text nodes in inserted elements (might occur when splitting a paragraph or pasting content inside text with wiki).
		// 检查插入元素中的文本节点(可能在分割段落或将内容粘贴到包含提及的文本中时发生)。
		if (change.name != '$text' && change.type == 'insert') {
			const insertedNode = position.nodeAfter;
			for (const item of writer.createRangeIn(insertedNode).getItems()) {
				wasChanged = checkAndFix(item, writer) || wasChanged;
			}
		}
		// Inserted inline elements might break wiki.
		if (change.type == 'insert' && schema.isInline(change.name)) {
			const nodeAfterInserted = position.nodeAfter && position.nodeAfter.nextSibling;
			wasChanged = checkAndFix(position.nodeBefore, writer) || wasChanged;
			wasChanged = checkAndFix(nodeAfterInserted, writer) || wasChanged;
		}
	}
	return wasChanged;
}


/**
 * This post-fixer will extend the attribute applied on the part of the wiki so the whole text node of the wiki will have the added attribute.
 * 这个后置修复器将扩展应用于提及部分的属性，因此提及的整个文本节点将具有添加的属性。
*/
function extendAttributeOnMentionPostFixer(writer, doc) {
	const changes = doc.differ.getChanges();
	let wasChanged = false;
	for (const change of changes) {
		if (change.type === 'attribute' && change.attributeKey != 'wiki') {
			// Checks the node on the left side of the range...
			const nodeBefore = change.range.start.nodeBefore;
			// ... and on the right side of the range.
			const nodeAfter = change.range.end.nodeAfter;
			for (const node of [nodeBefore, nodeAfter]) {
				if (isBrokenMentionNode(node) && node.getAttribute(change.attributeKey) != change.attributeNewValue) {
					writer.setAttribute(change.attributeKey, change.attributeNewValue, node);
					wasChanged = true;
				}
			}
		}
	}
	return wasChanged;
}

/**
 * Helper function to detect if wiki attribute should be removed from selection.
 * This check makes only sense if the selection has wiki attribute.
 *
 * The wiki attribute should be removed from a selection when selection focus is placed:
 * a) after a text node
 * b) the position is at parents start - the selection will set attributes from node after.
 * 辅助函数，用于检测是否应该从选择中删除提及属性。
 * 此检查仅在选择包含提及属性时才有意义。
 * 当选择焦点被放置时，应该从选择中删除提及属性:
 * 	a)在文本节点之后
 * 	b)位置是在父节点开始-选择将设置属性从节点后。
 */
function shouldNotTypeWithMentionAt(position) {
	const isAtStart = position.isAtStart;
	const isAfterAMention = position.nodeBefore && position.nodeBefore.is('$text');
	return isAfterAMention || isAtStart;
}
/**
 * Model post-fixer that disallows typing with selection when the selection is placed after the text node with the wiki attribute or before a text node with wiki attribute.
 * 
 * 当选择项被放置在带有提及属性的文本节点之后或带有提及属性的文本节点之前时，模型后置修复器禁止键入选择项。
*/
function selectionMentionAttributePostFixer(writer, doc) {
	const selection = doc.selection;
	const focus = selection.focus;
	if (selection.isCollapsed && selection.hasAttribute('wiki') && shouldNotTypeWithMentionAt(focus)) {
		writer.removeSelectionAttribute('wiki');
		return true;
	}
	return false;
}

/**
 * @internal
*/
export function _addMentionAttributes(baseMentionData, data) {
	return Object.assign({ uid: uid() }, baseMentionData, data || {});
}

/**
 * Creates a wiki attribute value from the provided view element and optional data.
 * 从提供的视图元素和可选数据创建一个提及属性值。
 * 
 * This function is exposed as
 * {@link module:wiki/wiki~Wiki#toMentionAttribute `editor.plugins.get( 'Wiki' ).toMentionAttribute()`}.
 *
 * @internal
*/
export function _toMentionAttribute(viewElementOrMention, data) {

	// const link = viewElementOrMention.getAttribute('href');
	// return link;


	// 从元素中 找到 对应的属性
	const dataName = viewElementOrMention.getAttribute('data-href');
	const dataId = viewElementOrMention.getAttribute('data-wiki');
	const textNode = viewElementOrMention.getChild(0);
	// Do not convert empty mentions.
	if (!textNode) {
		return;
	}
	const baseMentionData = {
		id: dataId,
		name: dataName,
		_text: textNode.data
	};
	return _addMentionAttributes(baseMentionData, data);
}

export default class AbbreviationEditing extends Plugin {
	init() {
		this._defineSchema();
		this._defineConverters();

		this.editor.commands.add(
			'addWiki', new AbbreviationCommand(this.editor)
		);

		const model = this.editor.model;

		// 栈, 使用栈记录[[]]包裹的内容, 遇到两次[[开始记录,到]]结束
		// 遇到回车终止记录,重新开始
		// 成功结束后,需要将[[xxx]]中的xxx解析,如果xxx是网址,则请求,并拿到title用a标签展示,否则不做处理
		// const stringStack = [];

		// // let startSelection = null;
		// let prevStartStr = '';
		// let prevEndStr = '';
		// let isBegin = false;

		// If the enter command is added to the editor, alter its behavior.
		// Enter at the end of a heading element should create a paragraph.
		const editor = this.editor;
		// const enterCommand = editor.commands.get('enter');
		// const options = editor.config.get('heading.options');


		const inputCommand = editor.commands.get('input');

		let timer = null;

		if (inputCommand) {
			// 监听输入事件，当输入[，自动补全]，每次必然形成[]组合
			this.listenTo(inputCommand, "execute", (evt, data) => {
				const positionParent = model.document.selection.getFirstPosition();

				console.log('input...', evt, data, positionParent);

				// // 寻找到wiki标记

				// if (timer) {
				// 	clearTimeout(timer);
				// }
				// timer = setTimeout(() => {
				// 	console.log("show wiki list");
				// 	this.editor.fire("showWikiList");
				// }, 300)

				// 输入
				if (data && data[0] && data[0].text === '[') {			
					model.change(writer => {
						console.log("model change..", writer, data[0].selection);
						// 插入文本
						model.insertContent(writer.createText(']'));
						// 调整被选择区域至当前字符处，也就是[后面，]前面
						writer.setSelection( data[0].selection );
					})
				}




				// else if (args && args[0] && args[0].text === ']' && prevStartStr === '[[') {
				// 	// 如果是第一个], 记录一下,方便第二次进行对比
				// 	if (prevEndStr === '') {
				// 		prevEndStr = ']';
				// 	} else if (prevEndStr === ']') {
				// 		// 如果连续两个], 则说明当前输入结束,准备转化
				// 		isBegin = false;
				// 		prevEndStr = ']]'

				// 		const endSelection = args[0].selection
				// 		console.log('终止了!', startSelection, endSelection)

				// 		const _range = model.createRange(startSelection.anchor, endSelection.anchor)
				// 		console.log('editor.view', _range, getRangeText(_range))

				// 		// writer.setAttribute( 'wiki', 'http://baidu.test', _range );

				// 		setTimeout(() => {
				// 			this.editor.execute( 'addWiki', {
				// 				link: getRangeText(_range).slice(1, -2),
				// 				title: "test"
				// 			} );
				// 		}, 1000)

				// 		console.log("准备移除range")
				// 		// model.writer.remove(_range);
				// 		_range.deleteContents();
				// 		_range.select(); 
				// 		console.log("移除range完毕")
				// 	}
				// } else if (isBegin) {
				// 	console.log("开始记录后的  正常输入");
				// }
			})
		}
	}
	_defineSchema() {
		const schema = this.editor.model.schema;

		// 我们将使用 方法扩展文本节点的模式以接受我们的缩写属性schema.extend()。
		// Extend the text node's schema to accept the abbreviation attribute. 扩展文本节点的模式以接受缩写属性。
		schema.extend('$text', {
			allowAttributes: 'wiki'
		});
	}
	_defineConverters() {
		const conversion = this.editor.conversion;
		const model = this.editor.model;
		const doc = model.document;

		// attributeToElement()将模型缩写属性转换为视图<abbr>元素。
		// Conversion from a model attribute to a view element
		conversion.for('downcast').attributeToElement({
			model: 'wiki',

			// 我们将需要使用回调函数，以获取存储为模型属性值的标题并将其转换为视图元素的标题值。
			// 这里，视图回调的第二个参数是DowncastConversionApi对象。
			// 我们将使用它的writer属性，这将允许我们在向下转换期间操作数据，因为它包含DowncastWriter.


			// Callback function provides access to the model attribute value and the DowncastWriter
			// 回调函数提供了对模型属性值和DowncastWriter的访问
			view: (modelAttributeValue, conversionApi) => {
				if (!modelAttributeValue) {
					return;
				}
				const { writer } = conversionApi;
				console.log('modelAttributeValue', modelAttributeValue);
				// <wiki href="xxx"></wiki>
				return writer.createAttributeElement('a', {
					'data-href': modelAttributeValue.name,
					'data-origin': `[[${modelAttributeValue.name}]]`,
					'data-type': "wiki",
					// 没啥用
					// 'data-wiki': modelAttributeValue.id,
				}, {
					id: modelAttributeValue.uid,
					priority: 20
				});
			}
		});

		// Conversion from a view element to a model attribute
		conversion.for('upcast').elementToAttribute({
			view: {
				name: 'a',
				key: 'data-wiki',
				attributes: ['data-href', 'data-origin', 'data-type']
			},
			model: {
				key: 'wiki',

				// Callback function provides access to the view element
				// 回调函数提供对视图元素的访问
				value: (viewElement) => _toMentionAttribute(viewElement)
			}
		});

		// 添加一个向下的解释器
		// downcast: 编辑和数据向下转换
		// conversion文档 （https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_conversion_conversion-Conversion.html）
		// editor.conversion.for("downcast") 返回一个 DowncastHelpers 实例 （https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_conversion_downcasthelpers-DowncastHelpers.html）
		// add( conversionHelper ) → DowncastHelpers

		conversion.for('downcast').add(preventPartialMentionDowncast);

		// 用于注册后修复器回调。post-fixer 机制保证功能将在正确的模型状态下运行。
		/**
		 * 功能的执行可能导致不正确的文档树状态。回调用于在更改后修复文档树。在应用最外层更改块的所有更改之后但在更改事件被触发之前，后修复器被触发。如果 post-fixer 回调进行了更改，它应该返回true. 发生这种情况时，将再次触发所有后修复程序以检查是否有其他内容不应在新文档树状态中修复。
		 * 
		 * 作为参数，post-fixer 回调接收与已执行更改块连接的编写器实例。由于这一点，回调完成的所有更改都将添加到与 原始更改相同的批次（和撤消步骤）。这使得后修复程序的更改对用户透明。
		 * 
		 * post-fixer 的一个例子是一个回调，它检查是否所有数据都从编辑器中删除。如果是这样，回调应该添加一个空段落，以便编辑器永远不会为空：
		*/
		doc.registerPostFixer(writer => removePartialMentionPostFixer(writer, doc, model.schema));

		doc.registerPostFixer(writer => extendAttributeOnMentionPostFixer(writer, doc));

		doc.registerPostFixer(writer => selectionMentionAttributePostFixer(writer, doc));
	}
}