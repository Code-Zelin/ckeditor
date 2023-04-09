// abbreviation/abbreviation.js

import AbbreviationEditing from './editing';
import AbbreviationUI from './ui';
import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

export default class Abbreviation extends Plugin {
    static get requires() {
        return [ AbbreviationEditing, AbbreviationUI ];
    }
}
