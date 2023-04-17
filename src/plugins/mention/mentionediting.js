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
        editor.conversion.for('downcast').add(preventPartialMentionDowncast);
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
 */
function removePartialMentionPostFixer(writer, doc, schema) {
    const changes = doc.differ.getChanges();
    let wasChanged = false;
    for (const change of changes) {
        if (change.type == 'attribute') {
            continue;
        }
        // Checks the text node on the current position.
        const position = change.position;
        if (change.name == '$text') {
            const nodeAfterInsertedTextNode = position.textNode && position.textNode.nextSibling;
            // Checks the text node where the change occurred.
            wasChanged = checkAndFix(position.textNode, writer) || wasChanged;
            // Occurs on paste inside a text node with mention.
            wasChanged = checkAndFix(nodeAfterInsertedTextNode, writer) || wasChanged;
            wasChanged = checkAndFix(position.nodeBefore, writer) || wasChanged;
            wasChanged = checkAndFix(position.nodeAfter, writer) || wasChanged;
        }
        // Checks text nodes in inserted elements (might occur when splitting a paragraph or pasting content inside text with mention).
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
 * This post-fixer will extend the attribute applied on the part of the mention so the whole text node of the mention will have
 * the added attribute.
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
 */
function checkAndFix(textNode, writer) {
    if (isBrokenMentionNode(textNode)) {
        writer.removeAttribute('mention', textNode);
        return true;
    }
    return false;
}