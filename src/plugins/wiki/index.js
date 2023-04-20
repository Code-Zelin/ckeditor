/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import WikiEditing, { _toMentionAttribute } from './editing';
import WikiUI from './ui';

export default class Wiki extends Plugin {
	/**
	 * Creates a wiki attribute value from the provided view element and optional data.
	 * 从提供的视图元素和可选数据创建一个wiki属性值。
	 * ```ts
	 * editor.plugins.get( 'Mention' ).toMentionAttribute( viewElement, { userId: '1234' } );
	 *
	 * // For a view element: <wiki data-href="joe">John Doe</wiki>
	 * // it will return:
	 * // { id: 'joe', userId: '1234', uid: '7a7bc7...', _text: 'John Doe' }
	 * ```
	 *
	 * @param viewElement
	 * @param data Additional data to be stored in the wiki attribute.
	*/
	toMentionAttribute(viewElement, data) {
		return _toMentionAttribute(viewElement, data);
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'Wiki';
	}

	static get requires() {
		return [WikiEditing, WikiUI];
	}
}