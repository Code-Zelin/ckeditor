/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
/**
 * @module mention/mentionediting
 */
import { Plugin } from 'ckeditor5/src/core';
import { uid } from 'ckeditor5/src/utils';
import MentionCommand from './mentioncommand';
/**
 * The mention editing feature.
 *
 * It introduces the {@link module:mention/mentioncommand~MentionCommand command} and the `mention`
 * attribute in the {@link module:engine/model/model~Model model} which renders in the {@link module:engine/view/view view}
 * as a `<span class="mention" data-mention="@mention">`.
 */
export default class MentionEditing extends Plugin {
    /**
     * @inheritDoc
     */
    static get pluginName() {
        return 'MentionEditing';
    }
    /**
     * @inheritDoc
     */
    init() {
        const editor = this.editor;
        const model = editor.model;
        const doc = model.document;
        // Allow the mention attribute on all text nodes.
        // 允许在所有文本节点上使用mention属性。
        model.schema.extend('$text', { allowAttributes: 'mention' });
        // Upcast conversion. 视图转化成数据
        editor.conversion.for('upcast').elementToAttribute({
            view: {
                name: 'span',
                key: 'data-mention',
                classes: 'mention'
            },
            model: {
                key: 'mention',
                // 这里的viewElement 是 @ckeditor/ckeditor5-engine/src/model/element
                // https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_model_element-Element.html#function-getChild
                value: (viewElement) => _toMentionAttribute(viewElement)
            }
        });
        // Downcast conversion. 数据（modal）转化成标签（view）
        // https://ckeditor.com/docs/ckeditor5/latest/framework/deep-dive/conversion/downcast.html
        // 每当模型节点或属性需要转换为视图节点或属性时，就会发生向下转换过程。编辑器引擎运行转换过程，并使用插件注册的转换器。
        // 将model为mention的模型 转化成对应的 view（element）
        // 如: { model: "paragraph", view: 'p' } 会将  <paragraph></paragraph> 转化为 <p></p>
        editor.conversion.for('downcast').attributeToElement({
            /**
             * model 可以为 
             * 1. string
             * 2. 对象 { name: 'heading', attributes: [ 'level' ] }
             *      配置了attributes后，可以再function类型的view中，通过modelElement.getAttribute('level')获取model上的属性
             */
            model: 'mention',
            /**
             * view 可以是下列的类型
             *   1. string  // 例如 "p"，会生成一个p标签
             *   2. function // 下面的方法 等同于 view: "h" + level
             *      ( modelElement, { writer } ) => {
             *          // createContainerElement(tagName, attr属性对象: {}，children：node[])
                        return writer.createContainerElement(
                            'h' + modelElement.getAttribute( 'level' 
                        );
                    }
             */
            view: createViewMentionElement
        });
        // 添加一个向下的解释器
        // downcast: 编辑和数据向下转换
        // conversion文档 （https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_conversion_conversion-Conversion.html）
        // editor.conversion.for("downcast") 返回一个 DowncastHelpers 实例 （https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_conversion_downcasthelpers-DowncastHelpers.html）
        // add( conversionHelper ) → DowncastHelpers
        editor.conversion.for('downcast').add(preventPartialMentionDowncast);

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
        editor.commands.add('mention', new MentionCommand(editor));
    }
}
/**
 * @internal
 */
export function _addMentionAttributes(baseMentionData, data) {
    return Object.assign({ uid: uid() }, baseMentionData, data || {});
}
/**
 * Creates a mention attribute value from the provided view element and optional data.
 * 从提供的视图元素和可选数据创建一个提及属性值。
 * 
 * This function is exposed as
 * {@link module:mention/mention~Mention#toMentionAttribute `editor.plugins.get( 'Mention' ).toMentionAttribute()`}.
 *
 * @internal
 */
export function _toMentionAttribute(viewElementOrMention, data) {
    // 从元素中 找到 对应的属性
    const dataMention = viewElementOrMention.getAttribute('data-mention');
    const textNode = viewElementOrMention.getChild(0);
    // Do not convert empty mentions.
    if (!textNode) {
        return;
    }
    const baseMentionData = {
        id: dataMention,
        _text: textNode.data
    };
    return _addMentionAttributes(baseMentionData, data);
}
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
    dispatcher.on('attribute:mention', (evt, data, conversionApi) => {
        const mention = data.attributeNewValue;
        if (!data.item.is('$textProxy') || !mention) {
            return;
        }
        const start = data.range.start;
        const textNode = start.textNode || start.nodeAfter;
        if (textNode.data != mention._text) {
            // Consume item to prevent partial mention conversion.
            conversionApi.consumable.consume(data.item, evt.name);
        }
    }, { priority: 'highest' });
}
/**
 * Creates a mention element from the mention data.
 */
function createViewMentionElement(mention, { writer }) {
    if (!mention) {
        return;
    }
    const attributes = {
        class: 'mention',
        'data-mention': mention.id
    };
    const options = {
        id: mention.uid,
        priority: 20
    };
    return writer.createAttributeElement('span', attributes, options);
}
/**
 * Model post-fixer that disallows typing with selection when the selection is placed after the text node with the mention attribute or
 * before a text node with mention attribute.
 * 
 * 当选择项被放置在带有提及属性的文本节点之后或带有提及属性的文本节点之前时，模型后置修复器禁止键入选择项。
 */
function selectionMentionAttributePostFixer(writer, doc) {
    const selection = doc.selection;
    const focus = selection.focus;
    if (selection.isCollapsed && selection.hasAttribute('mention') && shouldNotTypeWithMentionAt(focus)) {
        writer.removeSelectionAttribute('mention');
        return true;
    }
    return false;
}
/**
 * Helper function to detect if mention attribute should be removed from selection.
 * This check makes only sense if the selection has mention attribute.
 *
 * The mention attribute should be removed from a selection when selection focus is placed:
 * a) after a text node
 * b) the position is at parents start - the selection will set attributes from node after.
 */
function shouldNotTypeWithMentionAt(position) {
    const isAtStart = position.isAtStart;
    const isAfterAMention = position.nodeBefore && position.nodeBefore.is('$text');
    return isAfterAMention || isAtStart;
}
/**
 * Model post-fixer that removes the mention attribute from the modified text node.
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
            // Occurs on paste inside a text node with mention.
            // 在带有提及的文本节点内粘贴时发生。
            wasChanged = checkAndFix(nodeAfterInsertedTextNode, writer) || wasChanged;
            wasChanged = checkAndFix(position.nodeBefore, writer) || wasChanged;
            wasChanged = checkAndFix(position.nodeAfter, writer) || wasChanged;
        }
        // Checks text nodes in inserted elements (might occur when splitting a paragraph or pasting content inside text with mention).
        // 检查插入元素中的文本节点(可能在分割段落或将内容粘贴到包含提及的文本中时发生)。
        if (change.name != '$text' && change.type == 'insert') {
            const insertedNode = position.nodeAfter;
            for (const item of writer.createRangeIn(insertedNode).getItems()) {
                wasChanged = checkAndFix(item, writer) || wasChanged;
            }
        }
        // Inserted inline elements might break mention.
        if (change.type == 'insert' && schema.isInline(change.name)) {
            const nodeAfterInserted = position.nodeAfter && position.nodeAfter.nextSibling;
            wasChanged = checkAndFix(position.nodeBefore, writer) || wasChanged;
            wasChanged = checkAndFix(nodeAfterInserted, writer) || wasChanged;
        }
    }
    return wasChanged;
}
/**
 * This post-fixer will extend the attribute applied on the part of the mention so the whole text node of the mention will have the added attribute.
 * 这个后置修复器将扩展应用于提及部分的属性，因此提及的整个文本节点将具有添加的属性。
 */
function extendAttributeOnMentionPostFixer(writer, doc) {
    const changes = doc.differ.getChanges();
    let wasChanged = false;
    for (const change of changes) {
        if (change.type === 'attribute' && change.attributeKey != 'mention') {
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
 * Checks if a node has a correct mention attribute if present.
 * Returns `true` if the node is text and has a mention attribute whose text does not match the expected mention text.
 * 
 * 检查节点是否有正确的提及属性(如果存在)。
 * 如果节点是文本且提及属性的文本与预期提及文本不匹配，则返回' true '。
 */
function isBrokenMentionNode(node) {
    if (!node || !(node.is('$text') || node.is('$textProxy')) || !node.hasAttribute('mention')) {
        return false;
    }
    const text = node.data;
    const mention = node.getAttribute('mention');
    const expectedText = mention._text;
    return text != expectedText;
}
/**
 * Fixes a mention on a text node if it needs a fix.
 * 
 * 修复需要修复的文本节点上的提及。
 */
function checkAndFix(textNode, writer) {
    if (isBrokenMentionNode(textNode)) {
        writer.removeAttribute('mention', textNode);
        return true;
    }
    return false;
}
