// abbreviation/abbreviationediting.js

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

export default class AbbreviationEditing extends Plugin {
    init() {
        console.log('AbbreviationEditing#init() got called');
        this._defineSchema();
        this._defineConverters();
    }

    _defineSchema() {
        // Previously defined schema.
        const schema = this.editor.model.schema;

        // Extend the text node's schema to accept the abbreviation attribute.
        schema.extend('$text', {
            allowAttributes: ['abbreviation']
        });// ...
    }

    _defineConverters() {									// ADDED
        const conversion = this.editor.conversion;

        // Conversion from a model attribute to a view element.
        conversion.for('downcast').attributeToElement({
            model: 'abbreviation',
            // Callback function provides access to the model attribute value
            // and the DowncastWriter.
            view: (modelAttributeValue, conversionApi) => {
                const { writer } = conversionApi;

                return writer.createAttributeElement('abbr', {
                    title: modelAttributeValue
                });
            }
        });

        // Conversion from a view element to a model attribute.
        conversion.for('upcast').elementToAttribute({
            view: {
                name: 'abbr',
                attributes: ['title']
            },
            model: {
                key: 'abbreviation',
                // Callback function provides access to the view element.
                value: viewElement => {
                    const title = viewElement.getAttribute('title');

                    return title;
                }
            }
        });

    }
}
