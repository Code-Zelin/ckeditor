/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
/**
 * @module list/listproperties/listpropertiesui
 */
import { Plugin } from 'ckeditor5/src/core';
import { ButtonView, SplitButtonView, createDropdown, focusChildOnDropdownOpen } from 'ckeditor5/src/ui';
import ListPropertiesView from './ui/listpropertiesview';
import bulletedListIcon from '../../theme/icons/bulletedlist.svg';
import numberedListIcon from '../../theme/icons/numberedlist.svg';
import listStyleDiscIcon from '../../theme/icons/liststyledisc.svg';
import listStyleCircleIcon from '../../theme/icons/liststylecircle.svg';
import listStyleSquareIcon from '../../theme/icons/liststylesquare.svg';
import listStyleDecimalIcon from '../../theme/icons/liststyledecimal.svg';
import listStyleDecimalWithLeadingZeroIcon from '../../theme/icons/liststyledecimalleadingzero.svg';
import listStyleLowerRomanIcon from '../../theme/icons/liststylelowerroman.svg';
import listStyleUpperRomanIcon from '../../theme/icons/liststyleupperroman.svg';
import listStyleLowerLatinIcon from '../../theme/icons/liststylelowerlatin.svg';
import listStyleUpperLatinIcon from '../../theme/icons/liststyleupperlatin.svg';
import '../../theme/liststyles.css';
/**
 * The list properties UI plugin. It introduces the extended `'bulletedList'` and `'numberedList'` toolbar
 * buttons that allow users to control such aspects of list as the marker, start index or order.
 *
 * **Note**: Buttons introduced by this plugin override implementations from the {@link module:list/list/listui~ListUI}
 * (because they share the same names).
 */
export default class ListPropertiesUI extends Plugin {
    /**
     * @inheritDoc
     */
    static get pluginName() {
        return 'ListPropertiesUI';
    }
    init() {
        const editor = this.editor;
        const t = editor.locale.t;
        const enabledProperties = editor.config.get('list.properties');
        // Note: When this plugin does not register the "bulletedList" dropdown due to properties configuration,
        // a simple button will be still registered under the same name by ListUI as a fallback. This should happen
        // in most editor configuration because the List plugin automatically requires ListUI.
        if (enabledProperties.styles) {
            editor.ui.componentFactory.add('bulletedList', getDropdownViewCreator({
                editor,
                parentCommandName: 'bulletedList',
                buttonLabel: t('Bulleted List'),
                buttonIcon: bulletedListIcon,
                styleGridAriaLabel: t('Bulleted list styles toolbar'),
                styleDefinitions: [
                    {
                        label: t('Toggle the disc list style'),
                        tooltip: t('Disc'),
                        type: 'disc',
                        icon: listStyleDiscIcon
                    },
                    {
                        label: t('Toggle the circle list style'),
                        tooltip: t('Circle'),
                        type: 'circle',
                        icon: listStyleCircleIcon
                    },
                    {
                        label: t('Toggle the square list style'),
                        tooltip: t('Square'),
                        type: 'square',
                        icon: listStyleSquareIcon
                    }
                ]
            }));
        }
        // Note: When this plugin does not register the "numberedList" dropdown due to properties configuration,
        // a simple button will be still registered under the same name by ListUI as a fallback. This should happen
        // in most editor configuration because the List plugin automatically requires ListUI.
        if (enabledProperties.styles || enabledProperties.startIndex || enabledProperties.reversed) {
            editor.ui.componentFactory.add('numberedList', getDropdownViewCreator({
                editor,
                parentCommandName: 'numberedList',
                buttonLabel: t('Numbered List'),
                buttonIcon: numberedListIcon,
                styleGridAriaLabel: t('Numbered list styles toolbar'),
                styleDefinitions: [
                    {
                        label: t('Toggle the decimal list style'),
                        tooltip: t('Decimal'),
                        type: 'decimal',
                        icon: listStyleDecimalIcon
                    },
                    {
                        label: t('Toggle the decimal with leading zero list style'),
                        tooltip: t('Decimal with leading zero'),
                        type: 'decimal-leading-zero',
                        icon: listStyleDecimalWithLeadingZeroIcon
                    },
                    {
                        label: t('Toggle the lower–roman list style'),
                        tooltip: t('Lower–roman'),
                        type: 'lower-roman',
                        icon: listStyleLowerRomanIcon
                    },
                    {
                        label: t('Toggle the upper–roman list style'),
                        tooltip: t('Upper-roman'),
                        type: 'upper-roman',
                        icon: listStyleUpperRomanIcon
                    },
                    {
                        label: t('Toggle the lower–latin list style'),
                        tooltip: t('Lower-latin'),
                        type: 'lower-latin',
                        icon: listStyleLowerLatinIcon
                    },
                    {
                        label: t('Toggle the upper–latin list style'),
                        tooltip: t('Upper-latin'),
                        type: 'upper-latin',
                        icon: listStyleUpperLatinIcon
                    }
                ]
            }));
        }
    }
}
/**
 * A helper that returns a function that creates a split button with a toolbar in the dropdown,
 * which in turn contains buttons allowing users to change list styles in the context of the current selection.
 *
 * @param options.editor
 * @param options.parentCommandName The name of the higher-order editor command associated with
 * the set of particular list styles (e.g. "bulletedList" for "disc", "circle", and "square" styles).
 * @param options.buttonLabel Label of the main part of the split button.
 * @param options.buttonIcon The SVG string of an icon for the main part of the split button.
 * @param options.styleGridAriaLabel The ARIA label for the styles grid in the split button dropdown.
 * @param options.styleDefinitions Definitions of the style buttons.
 * @returns A function that can be passed straight into {@link module:ui/componentfactory~ComponentFactory#add}.
 */
function getDropdownViewCreator({ editor, parentCommandName, buttonLabel, buttonIcon }) {
    return (locale) => {
        const mainButtonView = new ButtonView(locale);
        // Main button was clicked.
        mainButtonView.on('execute', () => {
            editor.execute(parentCommandName);
            editor.editing.view.focus();
        });
        mainButtonView.set({
            label: buttonLabel,
            icon: buttonIcon,
            tooltip: true,
            isToggleable: true
        });
        return mainButtonView;
    };
}
