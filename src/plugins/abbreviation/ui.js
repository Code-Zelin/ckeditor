import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import { ButtonView } from '@ckeditor/ckeditor5-ui';

export default class AbbreviationUI extends Plugin {
    init() {
        console.log('AbbreviationUI#init() got called');

        const editor = this.editor;

        // Register the button in the editor's UI component factory.
        editor.ui.componentFactory.add('abbreviation', () => {
            const button = new ButtonView();

            button.label = 'Abbreviation';
            button.tooltip = true;
            button.withText = true;

            this.listenTo(button, 'execute', () => {
                const title = 'What You See Is What You Get';
                const abbr = 'WYSIWYG';

                // Change the model to insert the abbreviation.
                editor.model.change(writer => {
                    editor.model.insertContent(
                        // Create a text node with the abbreviation attribute.
                        writer.createText(abbr, { abbreviation: title })
                    );
                });
            });

            return button;
        });
    }
}