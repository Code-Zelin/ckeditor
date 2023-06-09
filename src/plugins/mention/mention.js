/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
/**
 * @module mention/mention
 */
import { Plugin } from 'ckeditor5/src/core';
import MentionEditing, { _toMentionAttribute } from './mentionediting';
import MentionUI from './mentionui';
import '../theme/mention.css';
/**
 * The mention plugin.
 *
 * For a detailed overview, check the {@glink features/mentions Mention feature documentation}.
 */
export default class Mention extends Plugin {
    /**
     * Creates a mention attribute value from the provided view element and optional data.
     * 从提供的视图元素和可选数据创建一个提及属性值。
     * ```ts
     * editor.plugins.get( 'Mention' ).toMentionAttribute( viewElement, { userId: '1234' } );
     *
     * // For a view element: <span data-mention="@joe">@John Doe</span>
     * // it will return:
     * // { id: '@joe', userId: '1234', uid: '7a7bc7...', _text: '@John Doe' }
     * ```
     *
     * @param viewElement
     * @param data Additional data to be stored in the mention attribute.
     */
    toMentionAttribute(viewElement, data) {
        return _toMentionAttribute(viewElement, data);
    }
    /**
     * @inheritDoc
     */
    static get pluginName() {
        return 'Mention';
    }
    /**
     * @inheritDoc
     */
    static get requires() {
        return [MentionEditing, MentionUI];
    }
}
