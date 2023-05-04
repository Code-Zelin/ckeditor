/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module media-embed/mediaembedui
 */

import { Plugin } from 'ckeditor5/src/core';
import { FileDialogButtonView } from 'ckeditor5/src/upload';

import MediaEmbedEditing from './mediaembedediting';
import mediaIcon from '../theme/icons/media.svg';

/**
 * The media embed UI plugin.
 *
 * @extends module:core/plugin~Plugin
 */
export default class MediaEmbedUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [MediaEmbedEditing];
	}

	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'MediaEmbedUI';
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const t = editor.t;
		const command = editor.commands.get('mediaEmbed');

		editor.ui.componentFactory.add('mediaEmbed', locale => {
			// 文件上传按钮
			const view = new FileDialogButtonView(locale);
			view.set({
				allowMultipleFiles: true
			});

			view.buttonView.bind('isEnabled').to(command);
			view.buttonView.set({
				label: t('自定义上传'),
				icon: mediaIcon,
				tooltip: true
			});

			view.on('done', (evt, files) => {
				console.log("选择文件 done", files);
				const imagesToUpload = Array.from(files);

				console.log("images to upload...", imagesToUpload);

				if (imagesToUpload.length) {
					editor.execute('uploadMedia', { file: imagesToUpload });

					editor.editing.view.focus();
				}
			});
			return view;
		});
	}
}