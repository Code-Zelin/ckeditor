import { Plugin } from 'ckeditor5/src/core';
import { ButtonView, ContextualBalloon, clickOutsideHandler } from 'ckeditor5/src/ui';
import { CKEditorError, Collection, Rect, env, keyCodes, logWarning } from 'ckeditor5/src/utils';
import { TextWatcher } from 'ckeditor5/src/typing';
import WikisView from "./ui/wikisview";
import DomWrapperView from './ui/domwrapperview';
import MentionListItemView from "./ui/mentionlistitemview";
import { debounce } from 'lodash-es';

const VERTICAL_SPACING = 3;
// The key codes that mention UI handles when it is open (without commit keys).
const defaultHandledKeyCodes = [
    // 上箭头
    keyCodes.arrowup,
    // 下箭头
    keyCodes.arrowdown,
    // 退出
    keyCodes.esc
];
// Dropdown commit key codes.
const defaultCommitKeyCodes = [
    keyCodes.enter,
    keyCodes.tab
];

/**
 * Checks if string is a valid mention marker.
 */
function isValidMentionMarker(marker) {
    return marker && marker.length == 2 && marker == '[[';
}

/**
 * Returns the balloon positions data callbacks.
 * 提供气泡列表弹框的位置，四个顶点的位置
 */
function getBalloonPanelPositions(preferredPosition) {
    const positions = {
        // Positions the panel to the southeast of the caret rectangle.
        'caret_se': (targetRect) => {
            return {
                top: targetRect.bottom + VERTICAL_SPACING,
                left: targetRect.right,
                name: 'caret_se',
                config: {
                    withArrow: false
                }
            };
        },
        // Positions the panel to the northeast of the caret rectangle.
        'caret_ne': (targetRect, balloonRect) => {
            return {
                top: targetRect.top - balloonRect.height - VERTICAL_SPACING,
                left: targetRect.right,
                name: 'caret_ne',
                config: {
                    withArrow: false
                }
            };
        },
        // Positions the panel to the southwest of the caret rectangle.
        'caret_sw': (targetRect, balloonRect) => {
            return {
                top: targetRect.bottom + VERTICAL_SPACING,
                left: targetRect.right - balloonRect.width,
                name: 'caret_sw',
                config: {
                    withArrow: false
                }
            };
        },
        // Positions the panel to the northwest of the caret rect.
        'caret_nw': (targetRect, balloonRect) => {
            return {
                top: targetRect.top - balloonRect.height - VERTICAL_SPACING,
                left: targetRect.right - balloonRect.width,
                name: 'caret_nw',
                config: {
                    withArrow: false
                }
            };
        }
    };
    // Returns only the last position if it was matched to prevent the panel from jumping after the first match.
    if (Object.prototype.hasOwnProperty.call(positions, preferredPosition)) {
        return [
            positions[preferredPosition]
        ];
    }
    // By default return all position callbacks.
    return [
        positions.caret_se,
        positions.caret_sw,
        positions.caret_ne,
        positions.caret_nw
    ];
}
/**
 * Returns a marker definition of the last valid occurring marker in a given string.
 * 返回给定字符串中最后一个有效出现标记的标记定义。
 * If there is no valid marker in a string, it returns undefined.
 * 如果字符串中没有有效的标记，则返回undefined。
 *
 * Example of returned object:
 *
 * ```ts
 * {
 * 	marker: '@',
 * 	position: 4,
 * 	minimumCharacters: 0
 * }
 * ````
 *
 * @param feedsWithPattern Registered feeds in editor for mention plugin with created RegExp for matching marker.
 * 注册mention在编辑器中提到插件与创建的RegExp匹配标记。
 * 
 * 使用创建好的RegExp在editor中注册的feeds中匹配marker，并给mention插件使用
 * 
 * 
 * @param text String to find the marker in
 * @returns Matched marker's definition
 */
function getLastValidMarkerInText(feedsWithPattern, text) {
    let lastValidMarker;
    for (const feed of feedsWithPattern) {
        const currentMarkerLastIndex = text.lastIndexOf(feed.marker);
        if (currentMarkerLastIndex > 0 && !text.substring(currentMarkerLastIndex - 1).match(feed.pattern)) {
            continue;
        }
        if (!lastValidMarker || currentMarkerLastIndex >= lastValidMarker.position) {
            lastValidMarker = {
                marker: feed.marker,
                position: currentMarkerLastIndex,
                minimumCharacters: feed.minimumCharacters,
                pattern: feed.pattern
            };
        }
    }
    return lastValidMarker;
}
/**
 * Creates a RegExp pattern for the marker.
 * 为标记创建RegExp模式。
 *  
 * Function has to be exported to achieve 100% code coverage.
 * 函数必须导出以实现100%的代码覆盖率。
 */
export function createRegExp() {
    // \p{Ps} => \p{Open_Punctuation}  省略标点法；开放式标点
    // \p{Pi} => \p{Initial_Punctuation}  最初的标点符号
    const openAfterCharacters = env.features.isRegExpUnicodePropertySupported ? '\\p{Ps}\\p{Pi}"\'' : '\\(\\[{"\'';
    // The pattern consists of 3 groups:
    // - 0 (non-capturing): Opening sequence - start of the line, space or an opening punctuation character like "(" or "\"",
    // 开头序列 - 以行、空格或开头标点符号，如“(”或“\”，
    // - 1: The marker character,
    // - 2: Mention input (taking the minimal length into consideration to trigger the UI),
    //
    // The pattern matches up to the caret (end of string switch - $).
    //               (0:      opening sequence       )(1:   marker  )(2:                typed mention              )$
    // const pattern = ``;
    return new RegExp(/(?:^|[ \(\[{"'])(\[\[)([^\[\]]*)$/, 'u');
}
/**
 * Creates a test callback for the marker to be used in the text watcher instance.
 *
 * @param feedsWithPattern Feeds of mention plugin configured in editor with RegExp to match marker in text
 */
function createTestCallback(feedsWithPattern) {
    const textMatcher = (text) => {
        const markerDefinition = getLastValidMarkerInText(feedsWithPattern, text);
        if (!markerDefinition) {
            return false;
        }
        let splitStringFrom = 0;
        if (markerDefinition.position !== 0) {
            splitStringFrom = markerDefinition.position - 1;
        }
        const textToTest = text.substring(splitStringFrom);
        return markerDefinition.pattern.test(textToTest);
    };
    return textMatcher;
}
/**
 * Creates a text matcher from the marker.
 */
function requestFeedText(markerDefinition, text) {
    let splitStringFrom = 0;
    if (markerDefinition.position !== 0) {
        splitStringFrom = markerDefinition.position - 1;
    }
    const regExp = createRegExp(markerDefinition.marker, 0);
    const textToMatch = text.substring(splitStringFrom);
    const match = textToMatch.match(regExp);
    return match[2];
}
/**
 * The default feed callback.
 */
function createFeedCallback(feedItems) {
    return (feedText) => {
        const filteredItems = feedItems
            // Make the default mention feed case-insensitive.
            .filter(item => {
            // Item might be defined as object.
            const itemId = typeof item == 'string' ? item : String(item.id);
            // The default feed is case insensitive.
            return itemId.toLowerCase().includes(feedText.toLowerCase());
        });
        return filteredItems;
    };
}
/**
 * Checks if position in inside or right after a text with a mention.
 */
function isPositionInExistingMention(position) {
    // The text watcher listens only to changed range in selection - so the selection attributes are not yet available
    // and you cannot use selection.hasAttribute( 'wiki' ) just yet.
    // See https://github.com/ckeditor/ckeditor5-engine/issues/1723.
    const hasMention = position.textNode && position.textNode.hasAttribute('wiki');
    const nodeBefore = position.nodeBefore;
    return hasMention || nodeBefore && nodeBefore.is('$text') && nodeBefore.hasAttribute('wiki');
}
/**
 * Checks if the closest marker offset is at the beginning of a wiki.
 *
 * See https://github.com/ckeditor/ckeditor5/issues/11400.
 */
function isMarkerInExistingMention(markerPosition) {
    const nodeAfter = markerPosition.nodeAfter;
    return nodeAfter && nodeAfter.is('$text') && nodeAfter.hasAttribute('wiki');
}
/**
 * Checks the wiki plugins is in completion mode (e.g. when typing is after a valid wiki string like @foo).
 */
function checkIfStillInCompletionMode(editor) {
    return editor.model.markers.has('wiki');
}


export default class WikiUI extends Plugin {
    /**
     * @inheritDoc
     */
    static get pluginName() {
        return 'WikiUI';
    }
    /**
     * @inheritDoc
     */
    static get requires() {
        return [ContextualBalloon];
    }
    /**
     * @inheritDoc
     */
    constructor(editor) {
        super(editor);
        this._items = new Collection();
        this._mentionsView = this._createMentionView();
        this._mentionsConfigurations = new Map();
        this._requestFeedDebounced = debounce(this._requestFeed, 100);
        editor.config.define('wiki', { feeds: [] });
        this._balloon = {
            visibleView: false,
        };
    }

    /**
    * Returns true when {@link #_mentionsView} is in the {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon} and it is
    * currently visible.
    */
    get _isUIVisible() {
        return this._balloon.visibleView === this._mentionsView;
    }

    /**
     * @inheritDoc
     */
    init() {
        const editor = this.editor;
        // 从<Editor config={{ mention: { commitKeys: [xxx] } }} />上的config中取出mention.commitKeys
        const commitKeys = editor.config.get('mention.commitKeys') || defaultCommitKeyCodes;
        const handledKeyCodes = defaultHandledKeyCodes.concat(commitKeys);
        this._balloon = editor.plugins.get(ContextualBalloon);
        // Key listener that handles navigation in mention view.
        // 处理提及视图中导航的键侦听器。
        editor.editing.view.document.on('keydown', (evt, data) => {
            if (isHandledKey(data.keyCode) && this._isUIVisible) {
                data.preventDefault();
                // Required for Enter key overriding.
                // 输入键覆盖所需。
                evt.stop();
                // 上下选择列表中的item
                if (data.keyCode == keyCodes.arrowdown) {
                    this._mentionsView.selectNext();
                }
                if (data.keyCode == keyCodes.arrowup) {
                    this._mentionsView.selectPrevious();
                }
                if (commitKeys.includes(data.keyCode)) {
                    this._mentionsView.executeSelected();
                }
                // 点击ESC，隐藏列表
                if (data.keyCode == keyCodes.esc) {
                    this._hideUIAndRemoveMarker();
                }
            }
        }, { priority: 'highest' }); // Required to override the Enter key.
        // Close the dropdown upon clicking outside of the plugin UI.
        clickOutsideHandler({
            emitter: this._mentionsView,
            activator: () => this._isUIVisible,
            contextElements: () => [this._balloon.view.element],
            callback: () => this._hideUIAndRemoveMarker()
        });
        const feeds = editor.config.get('wiki.feeds');
        for (const mentionDescription of feeds) {
            console.log("feeds item _____", mentionDescription);
            const feed = mentionDescription.feed;
            const marker = mentionDescription.marker;
            if (!isValidMentionMarker(marker)) {
                /**
                 * The marker must be a single character.
                 *
                 * Correct markers: `'[['`
                 *
                 * @error mentionconfig-incorrect-marker
                 * @param marker Configured marker
                 */
                throw new CKEditorError('mentionconfig-incorrect-marker', null, { marker });
            }
            const feedCallback = typeof feed == 'function' ? feed.bind(this.editor) : createFeedCallback(feed);
            const itemRenderer = mentionDescription.itemRenderer;
            const definition = { marker, feedCallback, itemRenderer };
            this._mentionsConfigurations.set(marker, definition);
        }
        this._setupTextWatcher(feeds);
        this.listenTo(editor, 'change:isReadOnly', () => {
            this._hideUIAndRemoveMarker();
        });
        this.on('requestFeed:response', (evt, data) => this._handleFeedResponse(data));
        this.on('requestFeed:error', () => this._hideUIAndRemoveMarker());
        /**
         * Checks if a given key code is handled by the mention UI.
         */
        function isHandledKey(keyCode) {
            return handledKeyCodes.includes(keyCode);
        }
    }

    /**
     * @inheritDoc
     */
    destroy() {
        super.destroy();
        // Destroy created UI components as they are not automatically destroyed (see ckeditor5#1341).
        this._mentionsView.destroy();
    }

    /**
     * Registers a text watcher for the marker.
     */
    _setupTextWatcher(feeds) {
        const editor = this.editor;
        const feedsWithPattern = feeds.map(feed => ({
            ...feed,
            pattern: createRegExp(feed.marker, feed.minimumCharacters || 0)
        }));
        const watcher = new TextWatcher(editor.model, createTestCallback(feedsWithPattern));
        watcher.on('matched', (evt, data) => {
            const markerDefinition = getLastValidMarkerInText(feedsWithPattern, data.text);
            const selection = editor.model.document.selection;
            const focus = selection.focus;
            const markerPosition = editor.model.createPositionAt(focus.parent, markerDefinition.position);
            if (isPositionInExistingMention(focus) || isMarkerInExistingMention(markerPosition)) {
                this._hideUIAndRemoveMarker();
                return;
            }
            const feedText = requestFeedText(markerDefinition, data.text);
            const matchedTextLength = markerDefinition.marker.length + feedText.length;
            // Create a marker range.
            const start = focus.getShiftedBy(-matchedTextLength);
            const end = focus.getShiftedBy(-feedText.length);
            const markerRange = editor.model.createRange(start, end);

            console.group('%c[TextWatcher]%c matched', 'color: red', 'color: black', `"${feedText}"`);
            console.log('data#text', `"${data.text}"`);
            console.log('data#range', data.range.start.path, data.range.end.path);
            console.log('marker definition', markerDefinition);
            console.log('marker range', markerRange.start.path, markerRange.end.path);

            if (checkIfStillInCompletionMode(editor)) {
                const mentionMarker = editor.model.markers.get('wiki');
                // Update the marker - user might've moved the selection to other mention trigger.
                editor.model.change(writer => {
                    // console.log( '%c[Editing]%c Updating the marker.', 'color: purple', 'color: black' );
                    writer.updateMarker(mentionMarker, { range: markerRange });
                });
            }
            else {
                // https://ckeditor.com/docs/ckeditor5/latest/api/module_engine_model_writer-Writer.html
                editor.model.change(writer => {
                    /**
                     * Adds a marker. 
                     * Marker is a named range, which tracks changes in the document and updates its range automatically, when model tree changes.
                     * Marker是一个命名范围，它跟踪文档中的更改，并在模型树更改时自动更新其范围。
                     * 
                     * As the first parameter you can set marker name.
                     * 作为第一个参数，您可以设置标记名称。
                     * 
                     * The required options.usingOperation parameter lets you decide if the marker should be managed by operations or not.
                     * options.usingOperation是必填项，允许您决定是否应该由操作来管理标记。
                     * 
                     * See marker class description to learn about the difference between markers managed by operations and not-managed by operations.
                     * 请参阅标记类描述，了解由操作管理的标记与非由操作管理的标记之间的区别。
                     * 
                     * The options.affectsData parameter, which defaults to false, allows you to define if a marker affects the data. 
                     * options.affectsData，默认为false，允许您定义标记是否影响数据。
                     * 
                     * It should be true when the marker change changes the data returned by the editor.getData() method. 
                     * 当marker change 更改editor.getData()方法返回的数据时，它应该为真。
                     * 
                     * When set to true it fires the change:data event. When set to false it fires the change event.
                     * 当设置为true时，它会触发 change:data 事件。当设置为false时，它将触发 change 事件。
                     */
                    // console.log( '%c[Editing]%c Adding the marker.', 'color: purple', 'color: black' );
                    writer.addMarker('wiki', { range: markerRange, usingOperation: false, affectsData: false });
                });
            }
            this._requestFeedDebounced(markerDefinition.marker, feedText);
            // console.groupEnd( '[TextWatcher] matched' );
        });
        watcher.on('unmatched', () => {
            this._hideUIAndRemoveMarker();
        });
        const wikiCommand = editor.commands.get('addWiki');
        watcher.bind('isEnabled').to(wikiCommand);
        return watcher;
    }
    /**
     * Handles the feed response event data.
     */
    _handleFeedResponse(data) {
        console.log("_handleFeedResponse...", data);
        const { feed, marker } = data;
        // eslint-disable-next-line max-len
        // console.log( `%c[Feed]%c Response for "${ data.feedText }" (${ feed.length })`, 'color: blue', 'color: black', feed );
        // If the marker is not in the document happens when the selection had changed and the 'mention' marker was removed.
        if (!checkIfStillInCompletionMode(this.editor)) {
            return;
        }
        // Reset the view.
        this._items.clear();
        for (const feedItem of feed) {
            const item = typeof feedItem != 'object' ? { id: feedItem, text: feedItem } : feedItem;
            this._items.add({ item, marker });
        }
        const mentionMarker = this.editor.model.markers.get('wiki');
        // 根据当前组件的位置，召唤出弹框
        if (this._items.length) {
            this._showOrUpdateUI(mentionMarker);
        }
        else {
            // Do not show empty mention UI.
            this._hideUIAndRemoveMarker();
        }
    }
    /**
     * Shows the mentions balloon. If the panel is already visible, it will reposition it.
     */
    _showOrUpdateUI(markerMarker) {
        if (this._isUIVisible) {
            // console.log( '%c[UI]%c Updating position.', 'color: green', 'color: black' );
            // Update balloon position as the mention list view may change its size.
            this._balloon.updatePosition(this._getBalloonPanelPositionData(markerMarker, this._mentionsView.position));
        }
        else {
            // console.log( '%c[UI]%c Showing the UI.', 'color: green', 'color: black' );
            this._balloon.add({
                view: this._mentionsView,
                position: this._getBalloonPanelPositionData(markerMarker, this._mentionsView.position),
                singleViewMode: true
            });
        }
        this._mentionsView.position = this._balloon.view.position;
        this._mentionsView.selectFirst();
    }
    /**
     * Hides the mentions balloon and removes the 'mention' marker from the markers collection.
     */
    _hideUIAndRemoveMarker() {
        // Remove the mention view from balloon before removing marker - it is used by balloon position target().
        if (this._balloon.hasView(this._mentionsView)) {
            // console.log( '%c[UI]%c Hiding the UI.', 'color: green', 'color: black' );
            this._balloon.remove(this._mentionsView);
        }
        if (checkIfStillInCompletionMode(this.editor)) {
            // console.log( '%c[Editing]%c Removing marker.', 'color: purple', 'color: black' );
            this.editor.model.change(writer => writer.removeMarker('wiki'));
        }
        // Make the last matched position on panel view undefined so the #_getBalloonPanelPositionData() method will return all positions
        // on the next call.
        this._mentionsView.position = undefined;
    }

    /**
     * Creates a position options object used to position the balloon panel.
     * 创建一个位置选项对象，用于定位气球面板。
     *
     * @param mentionMarker
     * @param preferredPosition The name of the last matched position name.
     */
    _getBalloonPanelPositionData(mentionMarker, preferredPosition) {
        const editor = this.editor;
        const editing = editor.editing;
        const domConverter = editing.view.domConverter;
        const mapper = editing.mapper;

        return {
            target: () => {
                let modelRange = mentionMarker.getRange();
                // Target the UI to the model selection range - the marker has been removed so probably the UI will not be shown anyway.
                // The logic is used by ContextualBalloon to display another panel in the same place.
                if (modelRange.start.root.rootName == '$graveyard') {
                    modelRange = editor.model.document.selection.getFirstRange();
                }
                const viewRange = mapper.toViewRange(modelRange);
                const rangeRects = Rect.getDomRangeRects(domConverter.viewRangeToDom(viewRange));
                return rangeRects.pop();
            },
            limiter: () => {
                const view = this.editor.editing.view;
                const viewDocument = view.document;
                const editableElement = viewDocument.selection.editableElement;
                if (editableElement) {
                    return view.domConverter.mapViewToDom(editableElement.root);
                }
                return null;
            },
            positions: getBalloonPanelPositions(preferredPosition)
        };
    }

    /**
     * Returns item renderer for the marker.
     */
    _getItemRenderer(marker) {
        const { itemRenderer } = this._mentionsConfigurations.get(marker);
        return itemRenderer;
    }

    /**
     * Renders a single item in the autocomplete list.
     */
    _renderItem(item, marker) {
        const editor = this.editor;
        let view;
        let label = item.id;
        const renderer = this._getItemRenderer(marker);
        if (renderer) {
            const renderResult = renderer(item);
            if (typeof renderResult != 'string') {
                view = new DomWrapperView(editor.locale, renderResult);
            }
            else {
                label = renderResult;
            }
        }
        if (!view) {
            const buttonView = new ButtonView(editor.locale);
            buttonView.label = label;
            buttonView.withText = true;
            view = buttonView;
        }
        return view;
    }

    /**
     * Creates the {@link #_wikisView}.
     */
    _createMentionView() {
        const locale = this.editor.locale;
        const wikisView = new WikisView(locale);
        wikisView.items.bindTo(this._items).using(data => {
            const { item, marker } = data;
            // Set to 10 by default for backwards compatibility. See: #10479
            // 为了向后兼容，默认设置为10
            if (wikisView.items.length >= 5) {
                return null;
            }
            // 实例化列表View
            const listItemView = new MentionListItemView(locale);
            // 根据内容渲染列表中每个button
            const view = this._renderItem(item, marker);
            // 将来自集合内视图的选定事件委托给任何发射器。
            // 通过 viewX.fire( 'execute', customData ); 触发,
            // listItemView.on('execute', () => {})接收
            view.delegate('execute').to(listItemView);
            listItemView.children.add(view);
            listItemView.item = item;
            listItemView.marker = marker;
            listItemView.on('execute', () => {
                // 触发wikisView.on('execute', function);
                wikisView.fire('execute', {
                    item,
                    marker
                });
            });
            return listItemView;
        });
        wikisView.on('execute', (evt, data) => {
            const editor = this.editor;
            const model = editor.model;
            const item = data.item;
            const marker = data.marker;
            const wikiMarker = editor.model.markers.get('wiki');
            // Create a range on matched text.
            const end = model.createPositionAt(model.document.selection.focus);
            const start = model.createPositionAt(wikiMarker.getStart());
            // 向右偏移两位
            const range = model.createRange(start.getShiftedBy(2), end);
            this._hideUIAndRemoveMarker();
            // 使用给定的参数执行指定的命令。
            // 是 editor.commands.get( commandName ).execute(commandParams)的缩写
            // 触发editor.commands.add("addWiki", Class)
            
            // console.log("offset normal>>>", model.createPositionAt(wikiMarker.getStart()))
            // console.log("offset 2>>>", model.createPositionAt(wikiMarker.getStart(), 2))

            console.log("触发addWiki指令", data, marker, range, start, end);
            editor.execute('addWiki', {
                wikiData: item,
                ...item,
                marker,
                range
            });
            editor.editing.view.focus();
        });
        return wikisView;
    }

    /**
     * Requests a feed from a configured callbacks.
     *
     * @fires response
     * @fires discarded
     * @fires error
     */
    _requestFeed(marker, feedText) {
        console.log("_request feed>>>", marker, feedText)
        // console.log( '%c[Feed]%c Requesting for', 'color: blue', 'color: black', `"${ feedText }"` );
        // Store the last requested feed - it is used to discard any out-of order requests.
        this._lastRequested = feedText;
        const { feedCallback } = this._mentionsConfigurations.get(marker);
        const feedResponse = feedCallback(feedText);
        const isAsynchronous = feedResponse instanceof Promise;
        // For synchronous feeds (e.g. callbacks, arrays) fire the response event immediately.
        if (!isAsynchronous) {
            this.fire('requestFeed:response', { feed: feedResponse, marker, feedText });
            return;
        }
        // Handle the asynchronous responses.
        feedResponse
            .then(response => {
                console.log("feed response...", response);
                // Check the feed text of this response with the last requested one so either:
                if (this._lastRequested == feedText) {
                    // It is the same and fire the response event.
                    this.fire('requestFeed:response', { feed: response, marker, feedText });
                }
                else {
                    // It is different - most probably out-of-order one, so fire the discarded event.
                    this.fire('requestFeed:discarded', { feed: response, marker, feedText });
                }
            })
            .catch(error => {
                console.log("error...", error)
                this.fire('requestFeed:error', { error });
                /**
                 * The callback used for obtaining mention autocomplete feed thrown and error and the mention UI was hidden or
                 * not displayed at all.
                 *
                 * @error mention-feed-callback-error
                 */
                logWarning('mention-feed-callback-error', { marker });
            });
    }
}