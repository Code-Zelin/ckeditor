/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import findAttributeRange from '@ckeditor/ckeditor5-typing/src/utils/findattributerange'; 	
import getRangeText from './utils.js';
import { toMap } from '@ckeditor/ckeditor5-utils';						

export default class AbbreviationCommand extends Command {
    refresh() {
		const model = this.editor.model;
		const selection = model.document.selection;
		const firstRange = selection.getFirstRange();

		console.log("first_range", firstRange)

		// When the selection is collapsed, the command has a value if the caret is in an abbreviation.
		if ( firstRange.isCollapsed ) {
			if ( selection.hasAttribute( 'internalLink' ) ) {
				const attributeValue = selection.getAttribute( 'internalLink' );

				// Find the entire range containing the abbreviation under the caret position.
				const abbreviationRange = findAttributeRange( selection.getFirstPosition(), 'internalLink', attributeValue, model );

				this.value = {
					title: getRangeText( abbreviationRange ),
					link: attributeValue,
					range: abbreviationRange
				};
			} else {
				this.value = null;
			}
		}
		// When the selection is not collapsed, the command has a value if the selection contains a subset of a single abbreviation
		// or an entire abbreviation.
		else {
			if ( selection.hasAttribute( 'internalLink' ) ) {
				const attributeValue = selection.getAttribute( 'internalLink' );

				// Find the entire range containing the abbreviation under the caret position.
				const abbreviationRange = findAttributeRange( selection.getFirstPosition(), 'internalLink', attributeValue, model );

				if ( abbreviationRange.containsRange( firstRange, true ) ) {
					this.value = {
						title: getRangeText( firstRange ),
						link: attributeValue,
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
		this.isEnabled = model.schema.checkAttributeInSelection( selection, 'internalLink' );
	}

	execute( { link, title } ) {
		const model = this.editor.model;
		const selection = model.document.selection;

		model.change( writer => {
			// If selection is collapsed then update the selected abbreviation or insert a new one at the place of caret.
			if ( selection.isCollapsed ) {
				// When a collapsed selection is inside text with the "abbreviation" attribute, update its text and title.
				if ( this.value ) {
					const { end: positionAfter } = model.insertContent(
						writer.createText( title, { internalLink: link } ),
						this.value.range
					);
					// Put the selection at the end of the inserted abbreviation.
					writer.setSelection( positionAfter );
				}
				// If the collapsed selection is not in an existing abbreviation, insert a text node with the "abbreviation" attribute
				// in place of the caret. Because the selection is collapsed, the attribute value will be used as a data for text.
				// If the abbreviation is empty, do not do anything.
				else if ( title !== '' ) {
					const firstPosition = selection.getFirstPosition();

					// Collect all attributes of the user selection (could be "bold", "italic", etc.)
					const attributes = toMap( selection.getAttributes() );

					// Put the new attribute to the map of attributes.
					attributes.set( 'internalLink', link );

					// Inject the new text node with the abbreviation text with all selection attributes.
					const { end: positionAfter } = model.insertContent( writer.createText( title, attributes ), firstPosition );

					// Put the selection at the end of the inserted abbreviation. Using an end of a range returned from
					// insertContent() just in case nodes with the same attributes were merged.
					writer.setSelection( positionAfter );
				}

				// Remove the "abbreviation" attribute attribute from the selection. It stops adding a new content into the abbreviation
				// if the user starts to type.
				writer.removeSelectionAttribute( 'internalLink' );
			} else {
				// If the selection has non-collapsed ranges, change the attribute on nodes inside those ranges
				// omitting nodes where the "abbreviation" attribute is disallowed.
				const ranges = model.schema.getValidRanges( selection.getRanges(), 'internalLink' );

				for ( const range of ranges ) {
					writer.setAttribute( 'internalLink', link, range );
				}
			}
		} );
	}
}