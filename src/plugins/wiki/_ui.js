/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import { ContextualBalloon, clickOutsideHandler } from '@ckeditor/ckeditor5-ui';
import WikiListView from './view';
import getRangeText from './utils.js';

function renderRandomStr() {
	const list = ["a","b","c", "d", 1,2,3,4,5,6,7,8,9];

	function randomItem(_list) {
		const length = _list.length;
		const index = Math.floor(Math.random() * length);
		return _list[index];
	}

	return Array.from({ length: 5 }).map(item => Array.from({ length: 5 }).map(() => randomItem(list)).join(""));
}

export default class AbbreviationUI extends Plugin {
	static get requires() {
		return [ ContextualBalloon ];
	}

	init() {
		const editor = this.editor;

        // Create the balloon and the form view.
		this._balloon = this.editor.plugins.get( ContextualBalloon );
		console.log("bbbbb", this._balloon, ContextualBalloon)


		this.wikiListView = this._createFormView(["aa1", "ab2", "ac3", "ad4"]);

		editor.ui.componentFactory.add( 'wiki', () => {
			const button = new ButtonView();

			button.label = 'InternalLink';
			button.tooltip = true;
			button.withText = true;

			// Show the UI on button click.
			this.listenTo( button, 'execute', () => {
				this._showUI();
			} );

			return button;
		} );

		// editor.commands.add(
		// 	'showList',
		// 	new WikiListCommand(editor)
		// );

		editor.on('showWikiList', () => {
			console.log('on showWikiList');
			this._showUI();
		});
	}

	_createFormView(data) {
		const editor = this.editor;
		const wikiListView = new WikiListView( editor.locale, data );

		// Execute the command after clicking the "Save" button.
		this.listenTo( wikiListView, 'select', (_, wikiContent) => {
			console.log('wikilistView...select....', _, wikiContent);
			const value = {
				link: wikiContent,
				title: wikiContent
			};

			editor.execute( 'addWiki', value );

            // Hide the form view after submit.
			this._hideUI();
		} );

		console.log('_balloon_', this._balloon)

		// Hide the form view when clicking outside the balloon.
		clickOutsideHandler( {
			emitter: wikiListView,
			activator: () => this._balloon.visibleView === wikiListView,
			contextElements: [ this._balloon.view.element ],
			callback: () => this._hideUI()
		} );

		return wikiListView;
	}

	_showUI() {
		const selection = this.editor.model.document.selection;

		// Check the value of the command.
		const commandValue = this.editor.commands.get( 'addWiki' );

		console.log("command...value..", commandValue.link, commandValue.title)

		console.log(this._balloon)

		console.log(this.wikiListView)

		if (this._balloon.hasView(this.wikiListView)) {
			this._balloon.remove(this.wikiListView);
		}

		// 模拟获取接口
		setTimeout(() => {
			this.wikiListView = this._createFormView(renderRandomStr())
			this._balloon.add( {
				view: this.wikiListView,
				position: this._getBalloonPositionData()
			} );
		
		}, 1000);

		// setTimeout(() => {
		// 	const data = renderRandomStr();
		// 	console.log('settimeout', data)
		// 	this.wikiListView.renderData(data)
		// }, 1000)
		// Disable the input when the selection is not collapsed.
		// this.wikiListView.titleInputView.isEnabled = selection.getFirstRange().isCollapsed;

		// Fill the form using the state (value) of the command.
		// if ( commandValue ) {
		// 	this.wikiListView.linkInputView.fieldView.value = commandValue.link;
		// 	this.wikiListView.titleInputView.fieldView.value = commandValue.title;
		// } else {
		// 	// If the command has no value, put the currently selected text (not collapsed)
		// 	// in the first field and empty the second in that case.
		// 	const selectedText = getRangeText( selection.getFirstRange() );

		// 	this.wikiListView.linkInputView.fieldView.value = '';
		// 	this.wikiListView.titleInputView.fieldView.value = selectedText;
		// }

		// this.wikiListView.focus();
	}

	_hideUI() {
		// Clear the input field values and reset the form.

		this._balloon.remove( this.wikiListView );

		// Focus the editing view after inserting the abbreviation so the user can start typing the content
		// right away and keep the editor focused.
		this.editor.editing.view.focus();
	}

	_getBalloonPositionData() {
		const view = this.editor.editing.view;
		const viewDocument = view.document;
		let target = null;

		console.log("viewDocument.selection..", viewDocument.selection);
		// view.document.selection.getFirstRange
		// Returns copy of the first range in the selection. First range is the one which start position is before start position of all other ranges (not to confuse with the first range added to the selection). Returns null if no ranges are added to selection.
		// 返回选定的第一个范围的副本。第一个范围是开始位置在所有其他范围开始位置之前的范围(不要与添加到选择中的第一个范围混淆)。如果没有向选择中添加范围，则返回null。
		const firstRange = viewDocument.selection.getFirstRange();
		console.log("first range...", firstRange)

		// Set a target position by converting view selection range to DOM
		target = () => view.domConverter.viewRangeToDom( firstRange );

		return {
			target
		};
	}
}