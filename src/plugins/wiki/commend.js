/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import findAttributeRange from '@ckeditor/ckeditor5-typing/src/utils/findattributerange'; 	
import getRangeText from './utils.js';
import { _addMentionAttributes } from "./editing";
import { CKEditorError, toMap } from 'ckeditor5/src/utils';					

export default class AbbreviationCommand extends Command {
	clearRangeQueue = []

	clearWikiMarkerFunction() {
		const model = this.editor.model;
		while(this.clearRangeQueue.length > 0) {
			const firstRange = this.clearRangeQueue.shift();
			model.change( writer => {
				const currentAttributes = toMap(selection.getAttributes());
				model.insertContent(writer.createText(']]', currentAttributes), start.getShiftedBy(endOffset - currentEndOffset));
				model.insertContent(writer.createText('[[', currentAttributes), start.getShiftedBy(startOffset - currentStartOffset));
			} );
		}
	}

    refresh() {
		const model = this.editor.model;
		const selection = model.document.selection;
		const firstRange = selection.getFirstRange();

		console.log("first_range", firstRange)

		// When the selection is collapsed, the command has a value if the caret is in an abbreviation.
		if ( firstRange.isCollapsed ) {
			console.log("selection>>>", selection, selection.hasAttribute( 'wiki' ));
			if ( selection.hasAttribute( 'wiki' ) ) {
				// const start = firstRange.start;
				// const end = firstRange.end;

				// if (start.textNode === end.textNode) {
				// 	const currentStartOffset = start.offset;
				// 	const currentEndOffset = end.offset;
				// 	const { startOffset, endOffset } = end.textNode;
				// 	console.log("offset>>>>", startOffset, endOffset, currentStartOffset, currentEndOffset);
				// 	// 给wiki包裹上[[]]
				// 	model.change( writer => {
				// 		const currentAttributes = toMap(selection.getAttributes());
				// 		model.insertContent(writer.createText(']]', currentAttributes), end.getShiftedBy(endOffset - currentEndOffset));
				// 		model.insertContent(writer.createText('[[', currentAttributes), start.getShiftedBy(startOffset - currentStartOffset));
				// 	} );

				// 	this.clearRangeQueue.push([range, selection])
				// }
			} else {
				// this.clearWikiMarkerFunction();
			}
		}

		// The command is enabled when the "abbreviation" attribute can be set on the current model selection.
		this.isEnabled = model.schema.checkAttributeInSelection( selection, 'wiki' );
	}

	execute( { wikiData, id: wikiId, range, name, marker } ) {
		const model = this.editor.model;
		const document = model.document;
		const selection = document.selection;

		const wikiRange = range || selection.getFirstRange();
		const wikiText = name || wikiId;
		const wiki = _addMentionAttributes({ _text: wikiText, id: wikiId }, wikiData);

		console.log("command execute>>", wikiData, marker, wiki, wikiRange, wikiText)

		if (marker.length != 2 && marker === "[[") {
            /**
             * The marker must be a single character.
             *
             * Correct markers: `'[['`
             *
             * Incorrect markers: `'['`, `'@['`.
             *
             * See {@link module:wiki/wiki~WikiConfig}.
             *
             * @error mentioncommand-incorrect-marker
             */
            throw new CKEditorError('wikicommand-incorrect-marker', this);
        }

		model.change( writer => {
			const currentAttributes = toMap(selection.getAttributes());
            const attributesWithMention = new Map(currentAttributes.entries());
            attributesWithMention.set('wiki', wiki);
            // Replace a range with the text with a wiki.
			// 在当前标记的范围内，用wiki attribute 替换掉 文案，文字是wikiText，属性为attributesWithMention
            model.insertContent(writer.createText(wikiText, attributesWithMention), wikiRange);
		} );
	}
}