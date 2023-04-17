/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import {
	View,
	LabeledFieldView,
	createLabeledInputText,
	ButtonView,
	submitHandler
} from '@ckeditor/ckeditor5-ui';
import { icons } from '@ckeditor/ckeditor5-core';

export default class ListView extends View {
	constructor( locale, dataList ) {
		super( locale );

		// this.titleInputView = this._createInput( 'Add title' );
		// this.linkInputView = this._createInput( 'Add internal link' );

		// this.saveButtonView = this._createButton( 'Save', icons.check, 'ck-button-save' );
		// // Submit type of the button will trigger the submit event on entire form when clicked 
        // // (see submitHandler() in render() below).
		// this.saveButtonView.type = 'submit';

		// this.cancelButtonView = this._createButton( 'Cancel', icons.cancel, 'ck-button-cancel' );

		// // Delegate ButtonView#execute to FormView#cancel
		// this.cancelButtonView.delegate( 'execute' ).to( this, 'cancel' );

		this.renderData(dataList);
	}

	renderData(data) {
		console.log("renderdata...",data);
		const list = data.map(item => {
			const newView = this._createButton(item, 'ck-button');
			// 点击按钮，选择item
			newView.on( 'execute', () => {
				console.log('execute...', item);
				this.fire("select", item)
			})
			return newView;
		})

		this.childViews = this.createCollection(list);

		this.setTemplate( {
			tag: 'div',
			attributes: {
				class: [ 'ck', 'ck-abbr-ul' ],
				tabindex: '-1'
			},
			children: this.childViews
		} );
	}

	render() {
		super.render();

		// Submit the form when the user clicked the save button or pressed enter in the input.
		// submitHandler( {
		// 	view: this
		// } );
	}

	focus() {
		// this.childViews.first.focus();
	}

	// _createInput( label ) {
	// 	const labeledInput = new LabeledFieldView( this.locale, createLabeledInputText );

	// 	labeledInput.label = label;

	// 	return labeledInput;
	// }

	_createButton( label, className ) {
		const button = new ButtonView();

		button.set( {
			label,
			tooltip: true,
			class: className
		} );

		return button;
	}
}