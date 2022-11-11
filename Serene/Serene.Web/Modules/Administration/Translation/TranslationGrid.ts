import { Decorators, EntityGrid, GridUtils, LookupEditor, LookupEditorOptions, ToolButton, Widget } from "@serenity-is/corelib";
import { confirm, isEmptyOrNull, isTrimmedEmpty, notifySuccess, outerHtml, text, trimToEmpty, trimToNull } from "@serenity-is/corelib/q";
import { Column } from "@serenity-is/sleekgrid";
import { TranslationItem, TranslationService } from "../";

@Decorators.registerClass()
export class TranslationGrid extends EntityGrid<TranslationItem, any> {
    protected getIdProperty() { return "Key"; }
    protected getLocalTextPrefix() { return "Administration.Translation"; }
    protected getService() { return TranslationService.baseUrl; }

    private hasChanges: boolean;
    private searchText: string;
    private sourceLanguage: LookupEditor; 
    private targetLanguage: LookupEditor;
    private targetLanguageKey: string;

    constructor(container: JQuery) {
        super(container);

        this.element.on('keyup.' + this.uniqueName + ' change.' + this.uniqueName,
            'input.custom-text', e =>
        {
            var value = trimToNull($(e.target).val());
            if (value === '') {
                value = null;
            }
            this.view.getItemById($(e.target).data('key')).CustomText = value;
            this.hasChanges = true;
        });
    }

    protected onClick(e: JQueryEventObject, row: number, cell: number): any {
        super.onClick(e, row, cell);

        if (e.isDefaultPrevented()) {
            return;
        }

        let item = this.itemAt(row);
        let done: () => void;

        if ($(e.target).hasClass('source-text')) {
            e.preventDefault();
                
            done = () => {
                item.CustomText = item.SourceText;
                this.view.updateItem(item.Key, item);
                this.hasChanges = true;
            };

            if (isTrimmedEmpty(item.CustomText) ||
                (trimToEmpty(item.CustomText) === trimToEmpty(item.SourceText))) {
                done();
                return;
            }

            confirm(text('Db.Administration.Translation.OverrideConfirmation'), done);
            return;
        }

        if ($(e.target).hasClass('target-text')) {
            e.preventDefault();

            done = () => {
                item.CustomText = item.TargetText;
                this.view.updateItem(item.Key, item);
                this.hasChanges = true;
            };

            if (isTrimmedEmpty(item.CustomText) ||
                (trimToEmpty(item.CustomText) === trimToEmpty(item.TargetText))) {
                done();
                return;
            }

            confirm(text('Db.Administration.Translation.OverrideConfirmation'), done);
            return;
        }
    }

    protected getColumns(): Column[] {

        var columns: Column[] = [];
        columns.push({ field: 'Key', width: 300, sortable: false });

        columns.push({
            field: 'SourceText',
            width: 300,
            sortable: false,
            format: ctx => {
                return outerHtml($('<a/>')
                    .addClass('source-text')
                    .text(ctx.value || ''));
            }
        });

        columns.push({
            field: 'CustomText',
            width: 300,
            sortable: false,
            format: ctx => outerHtml($('<input/>')
                .addClass('custom-text')
                .attr('value', ctx.value)
                .attr('type', 'text')
                .attr('data-key', ctx.item.Key))
        });

        columns.push({
            field: 'TargetText',
            width: 300,
            sortable: false,
            format: ctx => outerHtml($('<a/>')
                .addClass('target-text')
                .text(ctx.value || ''))
        });

        return columns;
    }

    protected createToolbarExtensions(): void {
        super.createToolbarExtensions();

        let opt: LookupEditorOptions = {
            lookupKey: 'Administration.Language'
        };

        this.sourceLanguage = Widget.create({
            type: LookupEditor,
            element: el => el.appendTo(this.toolbar.element).attr('placeholder', '--- ' +
                text('Db.Administration.Translation.SourceLanguage') + ' ---'),
            options: opt
        });

        this.sourceLanguage.changeSelect2(e => {
            if (this.hasChanges) {
                this.saveChanges(this.targetLanguageKey).then(() => this.refresh());
            }
            else {
                this.refresh();
            }
        });

        this.targetLanguage = Widget.create({
            type: LookupEditor,
            element: el => el.appendTo(this.toolbar.element).attr('placeholder', '--- ' +
                text('Db.Administration.Translation.TargetLanguage') + ' ---'),
            options: opt
        });

        this.targetLanguage.changeSelect2(e => {
            if (this.hasChanges) {
                this.saveChanges(this.targetLanguageKey).then(() => this.refresh());
            }
            else {
                this.refresh();
            }
        });
    }

    protected saveChanges(language: string): PromiseLike<any> {
        var translations: { [key: string]: string } = {};
        for (let item of this.getItems()) {
            translations[item.Key] = item.CustomText;
        }

        return Promise.resolve(TranslationService.Update({
            TargetLanguageID: language,
            Translations: translations
        })).then(() => {
            this.hasChanges = false;
            language = trimToNull(language) || 'invariant';
            notifySuccess('User translations in "' + language +
                '" language are saved to "user.texts.' +
                language + '.json" ' + 'file under "~/App_Data/texts/"', '');
        });
    }

    protected onViewSubmit(): boolean {
        var request = this.view.params;
        request.SourceLanguageID = this.sourceLanguage.value;
        this.targetLanguageKey = this.targetLanguage.value || '';
        request.TargetLanguageID = this.targetLanguageKey;
        this.hasChanges = false;
        return super.onViewSubmit();
    }
    
    protected getButtons(): ToolButton[] {
        return [{
            title: text('Db.Administration.Translation.SaveChangesButton'),
            onClick: e => this.saveChanges(this.targetLanguageKey).then(() => this.refresh()),
            cssClass: 'apply-changes-button'
        }];
    }

    protected createQuickSearchInput() {
        GridUtils.addQuickSearchInputCustom(this.toolbar.element,
            (field, searchText) => {
                this.searchText = searchText;
                this.view.setItems(this.view.getItems(), true);
            });
    }

    protected onViewFilter(item: TranslationItem) {
        if (!super.onViewFilter(item)) {
            return false;
        }

        if (!this.searchText) {
            return true;
        }

        var sd = Select2.util.stripDiacritics;
        var searching = sd(this.searchText).toLowerCase();

        function match(str: string) {
            if (!str)
                return false;

            return str.toLowerCase().indexOf(searching) >= 0;
        }

        return isEmptyOrNull(searching) || match(item.Key) || match(item.SourceText) ||
            match(item.TargetText) || match(item.CustomText);
    }

    protected usePager() {
        return false;
    }
}