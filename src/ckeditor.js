/**
 * @license Copyright (c) 2014-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
import ClassicEditor from '@ckeditor/ckeditor5-editor-classic/src/classiceditor.js';
import Alignment from '@ckeditor/ckeditor5-alignment/src/alignment.js';
import AutoLink from '@ckeditor/ckeditor5-link/src/autolink.js';
import Autosave from '@ckeditor/ckeditor5-autosave/src/autosave.js';
import BlockQuote from '@ckeditor/ckeditor5-block-quote/src/blockquote.js';
import Bold from '@ckeditor/ckeditor5-basic-styles/src/bold.js';
import CloudServices from '@ckeditor/ckeditor5-cloud-services/src/cloudservices.js';
import Code from '@ckeditor/ckeditor5-basic-styles/src/code.js';
import CodeBlock from '@ckeditor/ckeditor5-code-block/src/codeblock.js';
import DataFilter from '@ckeditor/ckeditor5-html-support/src/datafilter.js';
import DataSchema from '@ckeditor/ckeditor5-html-support/src/dataschema.js';
import Essentials from '@ckeditor/ckeditor5-essentials/src/essentials.js';
import GeneralHtmlSupport from '@ckeditor/ckeditor5-html-support/src/generalhtmlsupport.js';
import Heading from '@ckeditor/ckeditor5-heading/src/heading.js';
import HorizontalLine from '@ckeditor/ckeditor5-horizontal-line/src/horizontalline.js';
import HtmlComment from '@ckeditor/ckeditor5-html-support/src/htmlcomment.js';
import HtmlEmbed from '@ckeditor/ckeditor5-html-embed/src/htmlembed.js';
import AutoImage from '@ckeditor/ckeditor5-image/src/autoimage.js';
import Image from '@ckeditor/ckeditor5-image/src/image.js';
import ImageToolbar from '@ckeditor/ckeditor5-image/src/imagetoolbar.js';
import ImageUpload from '@ckeditor/ckeditor5-image/src/imageupload.js';
import Italic from '@ckeditor/ckeditor5-basic-styles/src/italic.js';
import Link from '@ckeditor/ckeditor5-link/src/link.js';
import LinkImage from '@ckeditor/ckeditor5-link/src/linkimage.js';

// import Mention from '@ckeditor/ckeditor5-mention/src/mention.js';
import PageBreak from '@ckeditor/ckeditor5-page-break/src/pagebreak.js';
import Paragraph from '@ckeditor/ckeditor5-paragraph/src/paragraph.js';
import PasteFromOffice from '@ckeditor/ckeditor5-paste-from-office/src/pastefromoffice.js';
import RemoveFormat from '@ckeditor/ckeditor5-remove-format/src/removeformat.js';
import SourceEditing from '@ckeditor/ckeditor5-source-editing/src/sourceediting.js';
import StandardEditingMode from '@ckeditor/ckeditor5-restricted-editing/src/standardeditingmode.js';
import Strikethrough from '@ckeditor/ckeditor5-basic-styles/src/strikethrough.js';
import Style from '@ckeditor/ckeditor5-style/src/style.js';
import Subscript from '@ckeditor/ckeditor5-basic-styles/src/subscript.js';
import Superscript from '@ckeditor/ckeditor5-basic-styles/src/superscript.js';
import TextPartLanguage from '@ckeditor/ckeditor5-language/src/textpartlanguage.js';
import TextTransformation from '@ckeditor/ckeditor5-typing/src/texttransformation.js';
import Underline from '@ckeditor/ckeditor5-basic-styles/src/underline.js';
import WordCount from '@ckeditor/ckeditor5-word-count/src/wordcount.js';
import Base64UploadAdapter from '@ckeditor/ckeditor5-upload/src/adapters/base64uploadadapter.js';

import InternalLink from './plugins/wiki/index';					// ADDED
import Autoformat from './plugins//autoformat/autoformat';
import Markdown from './plugins/markdown-gfm/markdown.js';

import Mention from "./plugins/mention/mention";
import MediaEmbed from './plugins/media-embed/src/mediaembed.js';
import MediaEmbedToolbar from './plugins/media-embed/src/mediaembedtoolbar.js';

import List from './plugins/list/list.js';
import ListProperties from './plugins/list/listproperties.js';
import TodoList from './plugins/list/todolist';

class Editor extends ClassicEditor {}

// Plugins to include in the build.
Editor.builtinPlugins = [
	Alignment,
	Autoformat,
	AutoImage,
	AutoLink,
	Autosave,
	Base64UploadAdapter,
	BlockQuote,
	Bold,
	CloudServices,
	Code,
	CodeBlock,
	DataFilter,
	DataSchema,
	Essentials,
	GeneralHtmlSupport,
	Heading,
	HorizontalLine,
	HtmlComment,
	HtmlEmbed,
	Image,
	// ImageResize,
	// ImageStyle,
	ImageToolbar,
	ImageUpload,
	Italic,
	Link,
	LinkImage,
	List,
	ListProperties,
	Markdown,
	MediaEmbed,
	MediaEmbedToolbar,
	Mention,
	PageBreak,
	Paragraph,
	PasteFromOffice,
	RemoveFormat,
	SourceEditing,
	StandardEditingMode,
	Strikethrough,
	Style,
	Subscript,
	Superscript,
	TextPartLanguage,
	TextTransformation,
	TodoList,
	Underline,
	WordCount,
	InternalLink,
];

// Editor configuration.
Editor.defaultConfig = {
	toolbar: {
		items: [
			'undo',
			'redo',
			'|',
			'sourceEditing',
			'heading',
			'|',
			'bold',
			'italic',
			'strikethrough',
			'underline',
			'removeFormat',
			'|',
			'code',
			'codeBlock',
			'|',
			'imageUpload',
			'blockQuote',
			'mediaEmbed',
			'link',
			'|',
			'bulletedList',
			'numberedList',
			'todoList',
			'|',
			'wiki'
		]
	},
	language: 'zh-cn',
	image: {
		toolbar: [
			'imageTextAlternative',
			'linkImage'
		]
	},
};

export default Editor;
