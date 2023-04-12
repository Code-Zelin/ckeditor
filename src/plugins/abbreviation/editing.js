/**
 * @license Copyright (c) 2003-2022, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';

export default class AbbreviationEditing extends Plugin {
	init() {
		this._defineSchema();
		this._defineConverters();
	}
	_defineSchema() {
		const schema = this.editor.model.schema;

		// 我们将使用 方法扩展文本节点的模式以接受我们的缩写属性schema.extend()。
    	// Extend the text node's schema to accept the abbreviation attribute. 扩展文本节点的模式以接受缩写属性。
		schema.extend( '$text', {
			allowAttributes: [ 'abbreviation' ]
		} );
	}
	_defineConverters() {
		const conversion = this.editor.conversion;
		
		// attributeToElement()将模型缩写属性转换为视图<abbr>元素。
        // Conversion from a model attribute to a view element
		conversion.for( 'downcast' ).attributeToElement( {
			model: 'abbreviation',

			// 我们将需要使用回调函数，以获取存储为模型属性值的标题并将其转换为视图元素的标题值。
			// 这里，视图回调的第二个参数是DowncastConversionApi对象。
			// 我们将使用它的writer属性，这将允许我们在向下转换期间操作数据，因为它包含DowncastWriter.


            // Callback function provides access to the model attribute value and the DowncastWriter
			// 回调函数提供了对模型属性值和DowncastWriter的访问
			view: ( modelAttributeValue, conversionApi ) => {
				const { writer } = conversionApi;
				return writer.createAttributeElement( 'abbr', {
					title: modelAttributeValue
				} );
			}
		} );

		// Conversion from a view element to a model attribute
		conversion.for( 'upcast' ).elementToAttribute( {
			view: {
				name: 'abbr',
				attributes: [ 'title' ]
			},
			model: {
				key: 'abbreviation',

                // Callback function provides access to the view element
				value: viewElement => {
					const title = viewElement.getAttribute( 'title' );
					return title;
				}
			}
		} );
	}
}