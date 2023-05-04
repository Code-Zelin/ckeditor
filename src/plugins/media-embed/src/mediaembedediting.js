/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

/**
 * @module media-embed/mediaembedediting
 */

import { Plugin } from 'ckeditor5/src/core';
import { first } from 'ckeditor5/src/utils';

import { modelToViewUrlAttributeConverter } from './converters';
import MediaEmbedCommand from './mediaembedcommand';
import MediaRegistry from './mediaregistry';
import { toMediaWidget, createMediaFigureElement } from './utils';

// import { UpcastWriter } from 'ckeditor5/src/engine';
import { Notification } from 'ckeditor5/src/ui';
import { ClipboardPipeline } from 'ckeditor5/src/clipboard';
import { FileRepository } from 'ckeditor5/src/upload';
import MediaUtils from './mediautils';
import UploadImageCommand from './uploadimagecommand';
// import { createImageTypeRegExp, fetchLocalImage, isLocalImage } from './imageupload/utils';


import '../theme/mediaembedediting.css';

/**
 * The media embed editing feature.
 *
 * @extends module:core/plugin~Plugin
 */
export default class MediaEmbedEditing extends Plugin {
	/**
	 * @inheritDoc
	 */
	static get pluginName() {
		return 'MediaEmbedEditing';
	}

	/**
	 * @inheritDoc
	 */
	static get requires() {
		return [FileRepository, Notification, ClipboardPipeline, MediaUtils];
	}

	/**
	 * @inheritDoc
	 */
	constructor(editor) {
		super(editor);

		editor.config.define('mediaEmbed', {
			elementName: 'oembed',
			providers: [
				{
					name: 'dailymotion',
					url: /^dailymotion\.com\/video\/(\w+)/,
					html: match => {
						const id = match[1];

						return (
							'<div style="position: relative; padding-bottom: 100%; height: 0; ">' +
							`<iframe src="https://www.dailymotion.com/embed/video/${id}" ` +
							'style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;" ' +
							'frameborder="0" width="480" height="270" allowfullscreen allow="autoplay">' +
							'</iframe>' +
							'</div>'
						);
					}
				},

				{
					name: 'spotify',
					url: [
						/^open\.spotify\.com\/(artist\/\w+)/,
						/^open\.spotify\.com\/(album\/\w+)/,
						/^open\.spotify\.com\/(track\/\w+)/
					],
					html: match => {
						const id = match[1];

						return (
							'<div style="position: relative; padding-bottom: 100%; height: 0; padding-bottom: 126%;">' +
							`<iframe src="https://open.spotify.com/embed/${id}" ` +
							'style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;" ' +
							'frameborder="0" allowtransparency="true" allow="encrypted-media">' +
							'</iframe>' +
							'</div>'
						);
					}
				},

				{
					name: 'youtube',
					url: [
						/^(?:m\.)?youtube\.com\/watch\?v=([\w-]+)(?:&t=(\d+))?/,
						/^(?:m\.)?youtube\.com\/v\/([\w-]+)(?:\?t=(\d+))?/,
						/^youtube\.com\/embed\/([\w-]+)(?:\?start=(\d+))?/,
						/^youtu\.be\/([\w-]+)(?:\?t=(\d+))?/
					],
					html: match => {
						const id = match[1];
						const time = match[2];

						return (
							'<div style="position: relative; padding-bottom: 100%; height: 0; padding-bottom: 56.2493%;">' +
							`<iframe src="https://www.youtube.com/embed/${id}${time ? `?start=${time}` : ''}" ` +
							'style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;" ' +
							'frameborder="0" allow="autoplay; encrypted-media" allowfullscreen>' +
							'</iframe>' +
							'</div>'
						);
					}
				},

				{
					name: 'vimeo',
					url: [
						/^vimeo\.com\/(\d+)/,
						/^vimeo\.com\/[^/]+\/[^/]+\/video\/(\d+)/,
						/^vimeo\.com\/album\/[^/]+\/video\/(\d+)/,
						/^vimeo\.com\/channels\/[^/]+\/(\d+)/,
						/^vimeo\.com\/groups\/[^/]+\/videos\/(\d+)/,
						/^vimeo\.com\/ondemand\/[^/]+\/(\d+)/,
						/^player\.vimeo\.com\/video\/(\d+)/
					],
					html: match => {
						const id = match[1];

						return (
							'<div style="position: relative; padding-bottom: 100%; height: 0; padding-bottom: 56.2493%;">' +
							`<iframe src="https://player.vimeo.com/video/${id}" ` +
							'style="position: absolute; width: 100%; height: 100%; top: 0; left: 0;" ' +
							'frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen>' +
							'</iframe>' +
							'</div>'
						);
					}
				},

				{
					name: 'instagram',
					url: /^instagram\.com\/p\/(\w+)/
				},
				{
					name: 'twitter',
					url: /^twitter\.com/
				},
				{
					name: 'googleMaps',
					url: [
						/^google\.com\/maps/,
						/^goo\.gl\/maps/,
						/^maps\.google\.com/,
						/^maps\.app\.goo\.gl/
					]
				},
				{
					name: 'flickr',
					url: /^flickr\.com/
				},
				{
					name: 'facebook',
					url: /^facebook\.com/
				}
			]
		});

		/**
		 * The media registry managing the media providers in the editor.
		 *
		 * @member {module:media-embed/mediaregistry~MediaRegistry} #registry
		 */
		this.registry = new MediaRegistry(editor.locale, editor.config.get('mediaEmbed'));
	}

	/**
	 * @inheritDoc
	 */
	init() {
		const editor = this.editor;
		const schema = editor.model.schema;
		const t = editor.t;
		const conversion = editor.conversion;
		const renderMediaPreview = editor.config.get('mediaEmbed.previewsInData');
		const elementName = editor.config.get('mediaEmbed.elementName');

		const registry = this.registry;

		console.log("init editing....");

		editor.commands.add('mediaEmbed', new MediaEmbedCommand(editor));

		this.initUpload();

		// Configure the schema.
		schema.register('media', {
			inheritAllFrom: '$blockObject',
			allowAttributes: ['url']
		});

		// Model -> Data
		conversion.for('dataDowncast').elementToStructure({
			model: 'media',
			view: (modelElement, { writer }) => {
				const url = modelElement.getAttribute('url');

				return createMediaFigureElement(writer, registry, url, {
					elementName,
					renderMediaPreview: url && renderMediaPreview
				});
			}
		});

		// Model -> Data (url -> data-oembed-url)
		conversion.for('dataDowncast').add(
			modelToViewUrlAttributeConverter(registry, {
				elementName,
				renderMediaPreview
			}));

		// Model -> View (element)
		conversion.for('editingDowncast').elementToStructure({
			model: 'media',
			view: (modelElement, { writer }) => {
				const url = modelElement.getAttribute('url');
				const figure = createMediaFigureElement(writer, registry, url, {
					elementName,
					renderForEditingView: true
				});

				return toMediaWidget(figure, writer, t('media widget'));
			}
		});

		// Model -> View (url -> data-oembed-url)
		conversion.for('editingDowncast').add(
			modelToViewUrlAttributeConverter(registry, {
				elementName,
				renderForEditingView: true
			}));

		// View -> Model (data-oembed-url -> url)
		conversion.for('upcast')
			// Upcast semantic media.
			.elementToElement({
				view: element => ['oembed', elementName].includes(element.name) && element.getAttribute('url') ?
					{ name: true } :
					null,
				model: (viewMedia, { writer }) => {
					const url = viewMedia.getAttribute('url');

					if (registry.hasMedia(url)) {
						return writer.createElement('media', { url });
					}
				}
			})
			// Upcast non-semantic media.
			.elementToElement({
				view: {
					name: 'div',
					attributes: {
						'data-oembed-url': true
					}
				},
				model: (viewMedia, { writer }) => {
					const url = viewMedia.getAttribute('data-oembed-url');

					if (registry.hasMedia(url)) {
						return writer.createElement('media', { url });
					}
				}
			})
			// Consume `<figure class="media">` elements, that were left after upcast.
			.add(dispatcher => {
				dispatcher.on('element:figure', converter);

				function converter(evt, data, conversionApi) {
					if (!conversionApi.consumable.consume(data.viewItem, { name: true, classes: 'media' })) {
						return;
					}

					const { modelRange, modelCursor } = conversionApi.convertChildren(data.viewItem, data.modelCursor);

					data.modelRange = modelRange;
					data.modelCursor = modelCursor;

					const modelElement = first(modelRange.getItems());

					if (!modelElement) {
						// Revert consumed figure so other features can convert it.
						conversionApi.consumable.revert(data.viewItem, { name: true, classes: 'media' });
					}
				}
			});
	}

	initUpload() {
		const editor = this.editor;
		const doc = editor.model.document;
		const fileRepository = editor.plugins.get(FileRepository);
		const imageUtils = editor.plugins.get('MediaUtils');
		// const imageTypes = createImageTypeRegExp( editor.config.get( 'media.upload.types' ) );
		const uploadImageCommand = new UploadImageCommand(editor);

		console.log("init upload....")
		editor.commands.add('uploadMedia', uploadImageCommand);

		// Handle pasted images.
		// For every image file, a new file loader is created and a placeholder image is
		// inserted into the content. Then, those images are uploaded once they appear in the model
		// (see Document#change listener below).
		this.listenTo(editor.editing.view.document, 'clipboardInput', (evt, data) => {
			// Skip if non empty HTML data is included.
			// https://github.com/ckeditor/ckeditor5-upload/issues/68
			if (isHtmlIncluded(data.dataTransfer)) {
				return;
			}

			const images = Array.from(data.dataTransfer.files).filter(file => {
				if (!file) {
					return false;
				}
				return true;
			});

			if (!images.length) {
				return;
			}

			evt.stop();

			editor.model.change(writer => {
				// Set selection to paste target.
				if (data.targetRanges) {
					writer.setSelection(data.targetRanges.map(viewRange => editor.editing.mapper.toModelRange(viewRange)));
				}

				console.log("images...", images);

				// Upload images after the selection has changed in order to ensure the command's state is refreshed.
				editor.model.enqueueChange(() => {
					editor.execute('uploadMedia', { file: images });
				});
			});
		});

		// Prevents from the browser redirecting to the dropped image.
		editor.editing.view.document.on('dragover', (evt, data) => {
			data.preventDefault();
		});
	}


}

function getImagesFromChangeItem(editor, item) {
	// const imageUtils = editor.plugins.get('ImageUtils');

	return Array.from(editor.model.createRangeOn(item))
		// .filter(value => imageUtils.isImage(value.item))
		.map(value => value.item);
}



// Returns `true` if non-empty `text/html` is included in the data transfer.
//
// @param {module:engine/view/datatransfer~DataTransfer} dataTransfer
// @returns {Boolean}
export function isHtmlIncluded(dataTransfer) {
	return Array.from(dataTransfer.types).includes('text/html') && dataTransfer.getData('text/html') !== '';
}
