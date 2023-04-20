/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import findAttributeRange from '@ckeditor/ckeditor5-typing/src/utils/findattributerange'; 	
import getRangeText from './utils.js';
import { _addMentionAttributes } from "./editing";
import { CKEditorError, toMap } from 'ckeditor5/src/utils';
import { toMap } from '@ckeditor/ckeditor5-utils';						

export default class AbbreviationCommand extends Command {
    refresh() {
		const model = this.editor.model;
		const selection = model.document.selection;
		const firstRange = selection.getFirstRange();

		console.log("first_range", firstRange)

		// When the selection is collapsed, the command has a value if the caret is in an abbreviation.
		if ( firstRange.isCollapsed ) {
			if ( selection.hasAttribute( 'wiki' ) ) {
				const attributeValue = selection.getAttribute( 'wiki' );

				// Find the entire range containing the abbreviation under the caret position.
				const abbreviationRange = findAttributeRange( selection.getFirstPosition(), 'wiki', attributeValue, model );

				this.value = {
					title: getRangeText( abbreviationRange ),
					href: attributeValue,
					range: abbreviationRange
				};
			} else {
				this.value = null;
			}
		}
		// When the selection is not collapsed, the command has a value if the selection contains a subset of a single abbreviation
		// or an entire abbreviation.
		else {
			if ( selection.hasAttribute( 'wiki' ) ) {
				const attributeValue = selection.getAttribute( 'wiki' );

				// Find the entire range containing the abbreviation under the caret position.
				const abbreviationRange = findAttributeRange( selection.getFirstPosition(), 'wiki', attributeValue, model );

				if ( abbreviationRange.containsRange( firstRange, true ) ) {
					this.value = {
						title: getRangeText( firstRange ),
						href: attributeValue,
						range: firstRange
					};
				} else {
					this.value = null;
				}
			} else {
				this.value = null;
			}
		}

		// The command is enabled when the "abbreviation" attribute can be set on the current model selection.
		this.isEnabled = model.schema.checkAttributeInSelection( selection, 'wiki' );
	}

	execute( { wikiData, id: wikiId, range, text, marker } ) {
		const model = this.editor.model;
		const document = model.document;
		const selection = document.selection;

		const _wikiData = typeof wikiData == 'string' ? { id: wikiData } : wikiData;
		const wikiRange = range || sessionStorage.getFirstRange();
		const wikiText = text || wikiId;
		const wiki = _addMentionAttributes({ _text: wikiText, id: wikiId }, _wikiData);

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

		if (wikiId.slice(0, 2) != marker) {
            /**
             * The feed item ID must start with the marker character.
             *
             * Correct mention feed setting:
             *
             * ```ts
             * mentions: [
             * 	{
             * 		marker: '@',
             * 		feed: [ '@Ann', '@Barney', ... ]
             * 	}
             * ]
             * ```
             *
             * Incorrect mention feed setting:
             *
             * ```ts
             * mentions: [
             * 	{
             * 		marker: '@',
             * 		feed: [ 'Ann', 'Barney', ... ]
             * 	}
             * ]
             * ```
             *
             * @error mentioncommand-incorrect-id
			**/
            throw new CKEditorError('wikicommand-incorrect-id', this);
        }

		model.change( writer => {
			const currentAttributes = toMap(selection.getAttributes());
            const attributesWithMention = new Map(currentAttributes.entries());
            attributesWithMention.set('wiki', wiki);
            // Replace a range with the text with a wiki.
            model.insertContent(writer.createText(wikiText, attributesWithMention), wikiRange);
            model.insertContent(writer.createText(' ', currentAttributes), wikiRange.start.getShiftedBy(wikiText.length));
		} );
	}
}