/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import AbbreviationCommand from './commend';

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

				if (timer) {
					clearTimeout(timer);
				}
				timer = setTimeout(() => {
					console.log("show wiki list");
					this.editor.fire("showWikiList");
				}, 300)

				// 输入
				// if (data && data[0] && data[0].text === '[') {			
				// 	model.change(writer => {
				// 		console.log("model change..", writer, data[0].selection);
				// 		// 插入文本
				// 		model.insertContent(writer.createText(']'));
				// 		// 调整被选择区域至当前字符处，也就是[后面，]前面
				// 		writer.setSelection( data[0].selection );
				// 	})
				// }




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
			allowAttributes: ['wiki']
		});
	}
	_defineConverters() {
		const conversion = this.editor.conversion;

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
				const { writer } = conversionApi;
				// <wiki href="xxx"></wiki>
				return writer.createAttributeElement('wiki', {
					href: modelAttributeValue
				});
			}
		});

		// Conversion from a view element to a model attribute
		conversion.for('upcast').elementToAttribute({
			view: {
				name: 'wiki',
				attributes: ['href']
			},
			model: {
				key: 'wiki',

				// Callback function provides access to the view element
				// 回调函数提供对视图元素的访问
				value: viewElement => {
					const link = viewElement.getAttribute('href');
					return link;
				}
			}
		});
	}
}