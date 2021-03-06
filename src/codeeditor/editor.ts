// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  IDisposable
} from 'phosphor/lib/core/disposable';

import {
  ISignal, clearSignalData, defineSignal
} from 'phosphor/lib/core/signaling';

import {
  IChangedArgs
} from '../common/interfaces';

import {
  IObservableString
} from '../common/observablestring';


/**
 * A namespace for code editors.
 *
 * #### Notes
 * - A code editor is a set of common assumptions which hold for all concrete editors.
 * - Changes in implementations of the code editor should only be caused by changes in concrete editors.
 * - Common JLab services which are based on the code editor should belong to `IEditorServices`.
 */
export
namespace CodeEditor {
  /**
   * A zero-based position in the editor.
   */
  export
  interface IPosition {
    /**
     * The cursor line number.
     */
    readonly line: number;

    /**
     * The cursor column number.
     */
    readonly column: number;
  }

  /**
   * The dimension of an element.
   */
  export
  interface IDimension {
    /**
     * The width of an element in pixels.
     */
    readonly width: number;

    /**
     * The height of an element in pixels.
     */
    readonly height: number;
  }

  /**
   * An interface describing editor state coordinates.
   */
  export
  interface ICoordinate {
    /**
     * The left coordinate value.
     */
    readonly left: number;

    /**
     * The right coordinate value.
     */
    readonly right: number;

    /**
     * The top coordinate value.
     */
    readonly top: number;

    /**
     * The bottom coordinate value.
     */
    readonly bottom: number;
  }

  /**
   * A range.
   */
  export
  interface IRange {
    /**
     * The position of the first character in the current range.
     *
     * #### Notes
     * If this position is greater than [end] then the range is considered
     * to be backward.
     */
    readonly start: IPosition;

    /**
     * The position of the last character in the current range.
     *
     * #### Notes
     * If this position is less than [start] then the range is considered
     * to be backward.
     */
    readonly end: IPosition;
  }

  /**
   * A selection style.
   */
  export
  interface ISelectionStyle {
    /**
     * A class name added to a selection.
     */
    className?: string;

    /**
     * A display name added to a selection.
     */
    displayName?: string;
  }

  /**
   * A text selection.
   */
  export
  interface ITextSelection extends IRange {
    /**
     * The uuid of the text selection owner.
     */
    readonly uuid: string;

    /**
     * The style of this selection.
     */
    readonly style?: ISelectionStyle;
  }

  /**
   * An interface to manage selections by selection owners.
   *
   * #### Definitions
   * - a user code that has an associated uuid is called a selection owner, see `CodeEditor.ISelectionOwner`
   * - a selection belongs to a selection owner only if it is associated with the owner by an uuid, see `CodeEditor.ITextSelection`
   *
   * #### Read access
   * - any user code can observe any selection
   *
   * #### Write access
   * - if a user code is a selection owner then:
   *   - it can change selections beloging to it
   *   - but it must not change selections beloging to other selection owners
   * - otherwise it must not change any selection
   */
  export
  interface ISelections {

    /**
     * A signal emitted when selections changes.
     */
    readonly changed: ISignal<Selections, ISelections.IChangedArgs>;

    /**
     * The uuids of selection owners.
     */
    readonly uuids: string[];

    /**
     * Gets the selections for all the cursors in ascending order.
     *
     * @param uuid - The id of the selection owner.
     *
     * @returns A new array of text selections.
     */
    getSelections(uuid: string): ITextSelection[];

    /**
     * Sets the selections for all the cursors.
     *
     * @param uuid - The id of the selection owner.
     *
     * @param newSelections - The replacement text selections.
     */
    setSelections(uuid: string, newSelections: ITextSelection[]): void;
  }

  /**
   * A namespace for `ISelections`.
   */
  export
  namespace ISelections {
    /**
     * An arguments for the selection changed signal.
     */
    export
    interface IChangedArgs {
      /**
       * The uuid of a selection owner.
       */
      readonly uuid: string;
      /**
       * The old selections.
       */
      readonly oldSelections: ITextSelection[];
      /**
       * The new selections.
       */
      readonly newSelections: ITextSelection[];
    }
  }

  /**
   * Default implementation of `ISelections`.
   */
  export
  class Selections implements ISelections, IDisposable {
    /**
     * A signal emitted when selections changes.
     */
    readonly changed: ISignal<Selections, ISelections.IChangedArgs>;

    /**
     * Uuids of all selection owners.
     */
    get uuids(): string[] {
      return Object.keys(this._selections);
    }

    /**
     * Test whether the selections are disposed.
     */
    get isDisposed(): boolean {
      return this._isDisposed;
    }

    /**
     * Dispose of the resources used by the selections.
     */
    dispose(): void {
      if (this.isDisposed) {
        return;
      }
      this._selections = {};
      this._isDisposed = true;
      clearSignalData(this);
    }

    /**
     * Gets the selections for all the cursors in ascending order.
     *
     * @param uuid - The id of the selection owner.
     *
     * @returns A new array of text selections.
     */
    getSelections(uuid: string): ITextSelection[] {
      const selections = this._selections[uuid];
      return selections ? selections : [];
    }

    /**
     * Sets the selections for all the cursors.
     *
     * @param uuid - The id of the selection owner.
     *
     * @param newSelections - The replacement text selections.
     */
    setSelections(uuid: string, newSelections: ITextSelection[]): void {
      const oldSelections = this.getSelections(uuid);
      this.removeSelections(uuid);
      this.sortSelections(newSelections);
      this._selections[uuid] = newSelections;
      this.changed.emit({ uuid, oldSelections, newSelections });
    }

    /**
     * Sorts given selections in ascending order.
     */
    protected sortSelections(selections: ITextSelection[]) {
      selections.sort((selection, selection2) => {
        const result = selection.start.line - selection2.start.line;
        if (result !== 0) {
          return result;
        }
        return selection.start.column - selection2.start.column;
      });
    }

    /**
     * Removes selections by the given uuid.
     */
    protected removeSelections(uuid: string) {
      delete this._selections[uuid];
    }

    private _isDisposed = false;
    private _selections: {
      [key: string]: ITextSelection[] | null
    } = {};
  }

  /**
   * Define the signals for the `Selections` class.
   */
  defineSignal(Selections.prototype, 'changed');

  /**
   * An editor model.
   */
  export
  interface IModel extends IDisposable {
    /**
     * A signal emitted when a property changes.
     */
    mimeTypeChanged: ISignal<IModel, IChangedArgs<string>>;

    /**
     * The text stored in the model.
     */
    readonly value: IObservableString;

    /**
     * A mime type of the model.
     *
     * #### Notes
     * It is never `null`, the default mime type is `text/plain`.
     */
    mimeType: string;

    /**
     * The currently selected code.
     */
    readonly selections: ISelections;

    /**
     * Get the number of lines in the model.
     */
    readonly lineCount: number;

    /**
     * Returns the content for the given line number.
     *
     * @param line - The line of interest.
     *
     * @returns The value of the line.
     */
    getLine(line: number): string;

    /**
     * Find an offset for the given position.
     *
     * @param position - The position of interest.
     *
     * @returns The offset at the position.
     */
    getOffsetAt(position: IPosition): number;

    /**
     * Find a position for the given offset.
     *
     * @param offset - The offset of interest.
     *
     * @returns The position at the offset.
     */
    getPositionAt(offset: number): IPosition;

    /**
     * Undo one edit (if any undo events are stored).
     */
    undo(): void;

    /**
     * Redo one undone edit.
     */
    redo(): void;

    /**
     * Clear the undo history.
     */
    clearHistory(): void;
  }

  /**
   * A selection owner.
   */
  export
  interface ISelectionOwner {
    /**
     * The uuid of this selection owner.
     */
    readonly uuid: string;

    /**
     * Returns the primary position of the cursor, never `null`.
     */
    getCursorPosition(): IPosition;

    /**
     * Set the primary position of the cursor.
     *
     * @param position - The new primary position.
     *
     * #### Notes
     * This will remove any secondary cursors.
     */
    setCursorPosition(position: IPosition): void;

    /**
     * Returns the primary selection, never `null`.
     */
    getSelection(): IRange;

    /**
     * Set the primary selection.
     *
     * @param selection - The desired selection range.
     *
     * #### Notes
     * This will remove any secondary cursors.
     */
    setSelection(selection: IRange): void;

    /**
     * Gets the selections for all the cursors, never `null` or empty.
     */
    getSelections(): IRange[];

    /**
     * Sets the selections for all the cursors.
     *
     * @param selections - The new selections.
     *
     * #### Notes
     * Cursors will be removed or added, as necessary.
     * Passing an empty array resets a cursor position to the start of a
     * document.
     */
    setSelections(selections: IRange[]): void;
  }

  /**
   * A keydown handler type.
   *
   * #### Notes
   * Return `true` to prevent the default handling of the event by the
   * editor.
   */
  export
  type KeydownHandler = (instance: IEditor, event: KeyboardEvent) => boolean;

  /**
   * A widget that provides a code editor.
   */
  export
  interface IEditor extends ISelectionOwner, IDisposable {
    /**
     * Whether line numbers should be displayed. Defaults to false.
     */
    lineNumbers: boolean;

    /**
     * Set to false for horizontal scrolling. Defaults to true.
     */
    wordWrap: boolean;

    /**
     * Whether the editor is read-only.  Defaults to false.
     */
    readOnly: boolean;

    /**
     * The model used by the editor.
     */
    readonly model: IModel;

    /**
     * The height of a line in the editor in pixels.
     */
    readonly lineHeight: number;

    /**
     * The widget of a character in the editor in pixels.
     */
    readonly charWidth: number;

    /**
     * Handle keydown events for the editor.
     */
    onKeyDown: KeydownHandler | null;

    /**
     * Brings browser focus to this editor text.
     */
    focus(): void;

    /**
     * Test whether the editor has keyboard focus.
     */
    hasFocus(): boolean;

    /**
     * Repaint the editor.
     */
    refresh(): void;

    /**
     * Set the size of the editor.
     *
     * @param size - The desired size.
     *
     * #### Notes
     * Use `null` if the size is unknown.
     */
    setSize(size: IDimension | null): void;

    /**
     * Reveals the given position in the editor.
     *
     * @param position - The desired position to reveal.
     */
    revealPosition(position: IPosition): void;

    /**
     * Reveals the given selection in the editor.
     *
     * @param position - The desired selection to reveal.
     */
    revealSelection(selection: IRange): void;

    /**
     * Get the window coordinates given a cursor position.
     *
     * @param position - The desired position.
     *
     * @returns The coordinates of the position.
     */
    getCoordinate(position: IPosition): ICoordinate;
  }

  /**
   * The options used to initialize an editor.
   */
  export
  interface IOptions {
    /**
     * Whether line numbers should be displayed. Defaults to `false`.
     */
    lineNumbers?: boolean;

    /**
     * Set to false for horizontal scrolling. Defaults to `true`.
     */
    wordWrap?: boolean;

    /**
     * Whether the editor is read-only. Defaults to `false`.
     */
    readOnly?: boolean;

    /**
     * Extra options.
     */
    extra?: { [key: string]: any };
  }
}
