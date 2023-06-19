/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md or https://ckeditor.com/legal/ckeditor-oss-license
 */
/**
 * @module markdown-gfm/html2markdown
 */
/* eslint-disable @typescript-eslint/ban-ts-comment */
// Importing types for this package is problematic, so it's omitted.
// @ts-ignore
import TurndownService from 'turndown';
// There no avaialble types for 'turndown-plugin-gfm' module and it's not worth to generate them on our own.
// @ts-ignore
import { gfm } from 'turndown-plugin-gfm';
// Override the original escape method by not escaping links.
const originalEscape = TurndownService.prototype.escape;
function escape(string) {
    string = originalEscape(string);
    // Escape "<".
    string = string.replace(/</g, '\\<');
    return string;
}
TurndownService.prototype.escape = function (string) {
    // Urls should not be escaped. Our strategy is using a regex to find them and escape everything
    // which is out of the matches parts.
    let escaped = '';
    let lastLinkEnd = 0;
    for (const match of matchAutolink(string)) {
        const index = match.index;
        // Append the substring between the last match and the current one (if anything).
        if (index > lastLinkEnd) {
            escaped += escape(string.substring(lastLinkEnd, index));
        }
        const matchedURL = match[0];
        escaped += matchedURL;
        lastLinkEnd = index + matchedURL.length;
    }
    // Add text after the last link or at the string start if no matches.
    if (lastLinkEnd < string.length) {
        escaped += escape(string.substring(lastLinkEnd, string.length));
    }
    return escaped;
};
const turndownService = new TurndownService({
    codeBlockStyle: 'fenced',
    hr: '---',
    headingStyle: 'atx'
});
turndownService.use([
    gfm,
    todoList,
    wikiLink,
    mediaEmbed
]);

/**
 * Parses HTML to a markdown.
 */
export default function html2markdown(html) {
    console.log("html2md", html);

    const matchHtml = html.matchAll(/<figure class="media"><oembed url="(\S+)"><\/oembed>\<\/figure>/g)
    // 必须有内容，否则会认为是空标签，不做展示
    if (matchHtml) {
        for(let item of matchHtml) {
            const originHtml = item[0];
            const url = item[1];
            html = html.replace(originHtml, `<figure class="media"><oembed url="${url}">自定义上传<\/oembed><\/figure>`)
        }
    }

    return turndownService.turndown(html);
}
export { turndownService };
// This is a copy of the original taskListItems rule from turdown-plugin-gfm, with minor changes.
function todoList(turndownService) {
    turndownService.addRule('taskListItems', {
        filter(node) {
            return node.type === 'checkbox' &&
                // Changes here as CKEditor outputs a deeper structure.
                (node.parentNode.nodeName === 'LI' || node.parentNode.parentNode.nodeName === 'LI');
        },
        replacement(content, node) {
            return (node.checked ? '[x]' : '[ ]') + ' ';
        }
    });
}
// This is a copy of the original taskListItems rule from turdown-plugin-gfm, with minor changes.
function wikiLink(turndownService) {
    turndownService.addRule('wikiLink', {
        filter: ["wiki"],
        replacement(content, node) {
            console.log('wikiLink', content, node)
            return `${content}`;
        }
    });
}
// This is a copy of the original taskListItems rule from turdown-plugin-gfm, with minor changes.
function mediaEmbed(turndownService) {
    turndownService.addRule('mediaEmbed', {
        // <figure class="media"><oembed url="https://www.youtube.com/watch?v=5QtHtDkHT5Y"></oembed></figure>
        filter(node) {
            const firstChild = node.childNodes[0];
            console.log("mediaEmbed filter....", node, firstChild)
            return node.nodeName === 'FIGURE' && node.className === "media"
                && firstChild && firstChild.nodeName === 'OEMBED'
                && firstChild.getAttribute && firstChild.getAttribute("url");
        },
        replacement(content, node) {
            if (node.childNodes[0].getAttribute) {
                return `\n$$${node.childNodes[0].getAttribute("url")}$$\n`
            }
            return `\n$$${content}$$\n`;
        }
    });
}
// Autolink matcher.
const regex = new RegExp(
// Prefix.
/\b(?:(?:https?|ftp):\/\/|www\.)/.source +
    // Domain name.
    /(?![-_])(?:[-_a-z0-9\u00a1-\uffff]{1,63}\.)+(?:[a-z\u00a1-\uffff]{2,63})/.source +
    // The rest.
    /(?:[^\s<>]*)/.source, 'gi');
/**
 * Trimming end of link.
 * https://github.github.com/gfm/#autolinks-extension-
 */
function* matchAutolink(string) {
    for (const match of string.matchAll(regex)) {
        const matched = match[0];
        const length = autolinkFindEnd(matched);
        yield Object.assign([matched.substring(0, length)], { index: match.index });
        // We could adjust regex.lastIndex but it's not needed because what we skipped is for sure not a valid URL.
    }
}
/**
 * Returns the new length of the link (after it would trim trailing characters).
 */
function autolinkFindEnd(string) {
    let length = string.length;
    while (length > 0) {
        const char = string[length - 1];
        if ('?!.,:*_~\'"'.includes(char)) {
            length--;
        }
        else if (char == ')') {
            let openBrackets = 0;
            for (let i = 0; i < length; i++) {
                if (string[i] == '(') {
                    openBrackets++;
                }
                else if (string[i] == ')') {
                    openBrackets--;
                }
            }
            // If there is fewer opening brackets then closing ones we should remove a closing bracket.
            if (openBrackets < 0) {
                length--;
            }
            else {
                break;
            }
        }
        else {
            break;
        }
    }
    return length;
}
