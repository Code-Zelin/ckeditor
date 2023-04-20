import { Plugin } from 'ckeditor5/src/core';
import { ButtonView, ContextualBalloon, clickOutsideHandler } from 'ckeditor5/src/ui';
import { CKEditorError, Collection, Rect, env, keyCodes, logWarning } from 'ckeditor5/src/utils';
import { TextWatcher } from 'ckeditor5/src/typing';
import WikisView from "./ui/wikisview";
import MentionListItemView from "./ui/mentionlistitemview";

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
        const feeds = editor.config.get('mention.feeds');
        for (const mentionDescription of feeds) {
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
            // @if CK_DEBUG_MENTION // console.group( '%c[TextWatcher]%c matched', 'color: red', 'color: black', `"${ feedText }"` );
            // @if CK_DEBUG_MENTION // console.log( 'data#text', `"${ data.text }"` );
            // @if CK_DEBUG_MENTION // console.log( 'data#range', data.range.start.path, data.range.end.path );
            // @if CK_DEBUG_MENTION // console.log( 'marker definition', markerDefinition );
            // @if CK_DEBUG_MENTION // console.log( 'marker range', markerRange.start.path, markerRange.end.path );
            if (checkIfStillInCompletionMode(editor)) {
                const mentionMarker = editor.model.markers.get('mention');
                // Update the marker - user might've moved the selection to other mention trigger.
                editor.model.change(writer => {
                    // @if CK_DEBUG_MENTION // console.log( '%c[Editing]%c Updating the marker.', 'color: purple', 'color: black' );
                    writer.updateMarker(mentionMarker, { range: markerRange });
                });
            }
            else {
                editor.model.change(writer => {
                    // @if CK_DEBUG_MENTION // console.log( '%c[Editing]%c Adding the marker.', 'color: purple', 'color: black' );
                    writer.addMarker('mention', { range: markerRange, usingOperation: false, affectsData: false });
                });
            }
            this._requestFeedDebounced(markerDefinition.marker, feedText);
            // @if CK_DEBUG_MENTION // console.groupEnd( '[TextWatcher] matched' );
        });
        watcher.on('unmatched', () => {
            this._hideUIAndRemoveMarker();
        });
        const mentionCommand = editor.commands.get('mention');
        watcher.bind('isEnabled').to(mentionCommand);
        return watcher;
    }
    /**
     * Handles the feed response event data.
     */
    _handleFeedResponse(data) {
        const { feed, marker } = data;
        // eslint-disable-next-line max-len
        // @if CK_DEBUG_MENTION // console.log( `%c[Feed]%c Response for "${ data.feedText }" (${ feed.length })`, 'color: blue', 'color: black', feed );
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
        const mentionMarker = this.editor.model.markers.get('mention');
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
            // @if CK_DEBUG_MENTION // console.log( '%c[UI]%c Updating position.', 'color: green', 'color: black' );
            // Update balloon position as the mention list view may change its size.
            this._balloon.updatePosition(this._getBalloonPanelPositionData(markerMarker, this._mentionsView.position));
        }
        else {
            // @if CK_DEBUG_MENTION // console.log( '%c[UI]%c Showing the UI.', 'color: green', 'color: black' );
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
            // @if CK_DEBUG_MENTION // console.log( '%c[UI]%c Hiding the UI.', 'color: green', 'color: black' );
            this._balloon.remove(this._mentionsView);
        }
        if (checkIfStillInCompletionMode(this.editor)) {
            // @if CK_DEBUG_MENTION // console.log( '%c[Editing]%c Removing marker.', 'color: purple', 'color: black' );
            this.editor.model.change(writer => writer.removeMarker('mention'));
        }
        // Make the last matched position on panel view undefined so the #_getBalloonPanelPositionData() method will return all positions
        // on the next call.
        this._mentionsView.position = undefined;
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
            const dropdownLimit = this.editor.config.get('wiki.dropdownLimit') || 10;
            if (wikisView.items.length >= dropdownLimit) {
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
            const range = model.createRange(start, end);
            this._hideUIAndRemoveMarker();
            // 使用给定的参数执行指定的命令。
            // 是 editor.commands.get( commandName ).execute(commandParams)的缩写
            // 触发editor.commands.add("addWiki", Class)
            editor.execute('addWiki', {
                wikiData: item,
                text: item.text,
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
        // @if CK_DEBUG_MENTION // console.log( '%c[Feed]%c Requesting for', 'color: blue', 'color: black', `"${ feedText }"` );
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