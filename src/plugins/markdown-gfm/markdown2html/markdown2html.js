/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
/**
 * @module markdown-gfm/markdown2html
 */
import { marked } from 'marked';

// import {markedEmoji} from "marked-emoji";
import { Octokit } from "@octokit/rest";


// Overrides.
marked.use({
    tokenizer: {
        // Disable the autolink rule in the lexer.
        autolink: () => null,
        url: () => null
    },
    renderer: {
        checkbox(...args) {
            // Remove bogus space after <input type="checkbox"> because it would be preserved
            // by DomConverter as it's next to an inline object.
            return Object.getPrototypeOf(this).checkbox.call(this, ...args).trimRight();
        },
        code(...args) {
            // Since marked v1.2.8, every <code> gets a trailing "\n" whether it originally
            // ended with one or not (see https://github.com/markedjs/marked/issues/1884 to learn why).
            // This results in a redundant soft break in the model when loaded into the editor, which
            // is best prevented at this stage. See https://github.com/ckeditor/ckeditor5/issues/11124.
            return Object.getPrototypeOf(this).code.call(this, ...args).replace('\n</code>', '</code>');
        }
    }
});

function customHeadingId() {
    return {
        renderer: {
            heading(text, level, raw, slugger) {
                const headingIdRegex = /(?: +|^)\{#([a-z][\w-]*)\}(?: +|$)/i;
                const hasId = text.match(headingIdRegex);
                if (!hasId) {
                    // fallback to original heading renderer
                    return false;
                }
                return `<h${level} id="${hasId[1]}">${text.replace(headingIdRegex, '')}</h${level}>\n`;
            }
        }
    };
}

const defaultOptions = {
    // emojis: {}, required
    unicode: false
};

function markedInternalLink() {
    return {
        extensions: [{
            name: 'internalLink',
            level: 'inline',
            start(src) {
                console.log("start....", src);
                return src.indexOf('[[')
            },
            tokenizer(src, tokens) {
                const rule = /^\[\[([^\]]*)\]\]/
                const match = rule.exec(src)

                // match:: ['[[[[xxxx-xxxx]]', '[[xxxx-xxxx', index: 0, input: '[[[[xxxx-xxxx]]', groups: undefined]
                if (match) {
                    const token = {
                        type: 'internalLink',
                        raw: match[0],
                        text: match[1],
                        tokens: [],
                    }
                    return token
                }
            },
            renderer(token) {
                return `[[<wiki data-href="${token.text}">${token.text}</wiki>]]`;
            },
        },]
    };
}

// marked.use(customHeadingId());
// console.log("marked heading", marked.parse("# heading {#custom-id}"))

marked.use(markedInternalLink());
console.log("marked internalLink", marked.parse("[[[[xxxx-xxxx]]"))

/**
 * Parses markdown string to an HTML.
 * 解析markdown字符串到HTML。
 */
export default function markdown2html(markdown) {

    const options = {
        gfm: true,
        breaks: true,
        tables: true,
        xhtml: true,
        headerIds: false,
    };

    console.log('markdown2html::', markdown);
    return marked.parse(markdown, options);
}
export { marked };
