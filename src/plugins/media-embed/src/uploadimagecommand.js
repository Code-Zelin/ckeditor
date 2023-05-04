/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */

import { FileRepository } from 'ckeditor5/src/upload';
import { Command } from 'ckeditor5/src/core';
import { toArray } from 'ckeditor5/src/utils';
import { Notification } from 'ckeditor5/src/ui';

/**
 * @module image/imageupload/uploadimagecommand
 */

/**
 * The upload image command.
 *
 * The command is registered by the {@link module:image/imageupload/imageuploadediting~ImageUploadEditing} plugin as `uploadImage`
 * and it is also available via aliased `imageUpload` name.
 *
 * In order to upload an image at the current selection position
 * (according to the {@link module:widget/utils~findOptimalInsertionRange} algorithm),
 * execute the command and pass the native image file instance:
 *
 *		this.listenTo( editor.editing.view.document, 'clipboardInput', ( evt, data ) => {
 *			// Assuming that only images were pasted:
 *			const images = Array.from( data.dataTransfer.files );
 *
 *			// Upload the first image:
 *			editor.execute( 'uploadImage', { file: images[ 0 ] } );
 *		} );
 *
 * It is also possible to insert multiple images at once:
 *
 *		editor.execute( 'uploadImage', {
 *			file: [
 *				file1,
 *				file2
 *			]
 *		} );
 *
 * @extends module:core/command~Command
 */
export default class UploadImageCommand extends Command {
	/**
	 * @inheritDoc
	 */
	refresh() {
		console.log("Upload...command,,,")
		const editor = this.editor;
		const imageUtils = editor.plugins.get('MediaUtils');
		const selectedElement = editor.model.document.selection.getSelectedElement();

		// TODO: This needs refactoring.
		// isEnabled必须为true，才会正常触发execute
		this.isEnabled = true;

		// Set the default handler for feeding the image element with `src` and `srcset` attributes.
		this.on('uploadComplete', (evt, { data }) => {
			console.log("upload complate......media...", data, data.default)

			editor.execute('mediaEmbed', data.default);
			editor.editing.view.focus();
		}, { priority: 'low' });
	}

	/**
	 * Executes the command.
	 *
	 * @fires execute
	 * @param {Object} options Options for the executed command.
	 * @param {File|Array.<File>} options.file The image file or an array of image files to upload.
	 */
	execute(options) {
		console.log("commend .... execute....", options);
		const files = toArray(options.file);
		console.log("commend .... files....", files);
		const selection = this.editor.model.document.selection;
		// const imageUtils = this.editor.plugins.get( 'MediaUtils' );

		// In case of multiple files, each file (starting from the 2nd) will be inserted at a position that
		// follows the previous one. That will move the selection and, to stay on the safe side and make sure
		// all images inherit the same selection attributes, they are collected beforehand.
		//
		// Applying these attributes ensures, for instance, that inserting an (inline) image into a link does
		// not split that link but preserves its continuity.
		//
		// Note: Selection attributes that do not make sense for images will be filtered out by insertImage() anyway.
		const selectionAttributes = Object.fromEntries(selection.getAttributes());

		files.forEach((file, index) => {
			// const selectedElement = selection.getSelectedElement();

			console.log("upload....", index, file);

			// Inserting of an inline image replace the selected element and make a selection on the inserted image.
			// Therefore inserting multiple inline images requires creating position after each element.
			// if ( index && selectedElement && imageUtils.isImage( selectedElement ) ) {   
			// 	const position = this.editor.model.createPositionAfter( selectedElement );

			// 	this._uploadImage( file, selectionAttributes, position );
			// } else {
			this._uploadImage(file, selectionAttributes);
			// }
		});
	}

	/**
	 * Handles uploading single file.
	 *
	 * @private
	 * @param {File} file
	 * @param {Object} attributes
	 * @param {module:engine/model/position~Position} position
	 */
	_uploadImage(file, attributes, position) {
		const editor = this.editor;
		const fileRepository = editor.plugins.get(FileRepository);
		const loader = fileRepository.createLoader(file);
		console.log("upload image..", loader)

		// Do not throw when upload adapter is not set. FileRepository will log an error anyway.
		if (!loader) {
			return;
		}

		console.log("_uploading...", loader, loader.status);

		// Keep the mapping between the upload ID and the image model element so the upload
		// can later resolve in the context of the correct model element. The model element could
		// change for the same upload if one image was replaced by another (e.g. image type was changed),
		// so this may also replace an existing mapping.
		// this._uploadImageElements.set(uploadId, imageElement);

		if (loader.status == 'idle') {
			console.log("1123123", this)
			// If the image was inserted into content and has not been loaded yet, start loading it.
			this._readAndUpload(loader);
			// editor.model.change(writer => {

			// })
			// this.fire("readAndUpload", loader);
		}
	}

	_readAndUpload(loader) {
		console.log("_readAndUpload____", loader)
		const editor = this.editor;
		const model = editor.model;
		const t = editor.locale.t;
		const fileRepository = editor.plugins.get(FileRepository);

		return loader.read()
			.then(() => {
				const promise = loader.upload();
				console.log("ppppppp");

				return promise;
			})
			.then(data => {
				console.log("then.data...", data);
				model.enqueueChange({ isUndoable: false }, writer => {
					this.fire('uploadComplete', { data });
				});

				clean();
			})
			.catch(error => {
				console.log("errorrrrrr:::::", error);

				// If status is not 'error' nor 'aborted' - throw error because it means that something else went wrong,
				// it might be generic error and it would be real pain to find what is going on.
				if (loader.status !== 'error' && loader.status !== 'aborted') {
					throw error;
				}

				clean();
			});

		function clean() {
			fileRepository.destroyLoader(loader);
		}
	}
}
