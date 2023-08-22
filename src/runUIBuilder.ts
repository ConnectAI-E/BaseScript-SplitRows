import { bitable, FieldType, IOpenSegmentType } from "@base-open/web-api";

let table_id_tmp = localStorage.getItem("table_id_tmp");
const off = bitable.base.onSelectionChange((event) => {
  if (table_id_tmp !== event.data.tableId) {
    localStorage.setItem("table_id_tmp", event.data.tableId);
    window.location.href = window.location.href;
  }
})

export default async function main(uiBuilder: any) {
  uiBuilder.form((form: any) => ({
    formItems: [
      form.tableSelect('tableId', { label: '选择数据表' }),
      form.checkboxGroup('separater', { label: '选择分隔符（仅文本字段需选择分隔符）', options: ['空格', '换行符', '#', '\\', '/', '|', ',', ';'], defaultValue: ['换行符'] }),
      form.select('op_type', { label: '拆分记录模式', options: [{ label: '独立记录', value: '独立记录' }, { label: '子记录', value: '子记录' }], defaultValue: '独立记录' }),
      form.fieldSelect('fieldId_father', { label: '子记录模式请选择父记录字段（须先添加父记录字段）', sourceTable: 'tableId', filter: ({ type }: { type: any }) => type === FieldType.SingleLink || type === FieldType.DuplexLink, defaultValue: [''] }),
      form.checkboxGroup('delete_original_record', { label: '', options: ['删除原始记录'], defaultValue: [''] }),
    ],
    buttons: ['开始分行'],
  }), async ({ values }: { values: any }) => {

    const { tableId, separater, op_type, fieldId_father, delete_original_record } = values;
    // console.log(values);

    const getSelection = await bitable.base.getSelection();
    if (!tableId) { alert("请选择数据表"); return; }
    if (op_type === '子记录') {
      if (!fieldId_father) { alert("子记录模式下，必须选择父记录字段"); return; }
    }
    if (!getSelection.fieldId) { alert("请选中要分行的单元格"); return; }

    uiBuilder.showLoading('正在进行文本数据分行操作...');

    // console.log(getSelection);
    const table = await bitable.base.getTableById(tableId as string);

    // 根据选择的分隔符生成正则表达式
    let reg_str = "";
    const new_reg_list: any = [];
    separater.forEach((item: any) => {
      switch (item) {
        case "空格":
          new_reg_list.push(" ");
          break;
        case "换行符":
          new_reg_list.push("\n");
          break;
        case "\\":
          new_reg_list.push("\\\\");
          break;
        case "|":
          new_reg_list.push("\\|");
          break;
        default:
          new_reg_list.push(item);
          break;
      }
    });

    const new_record_fieldId: any = getSelection!.fieldId;
    const new_record_id: any = getSelection!.recordId;
    const field_meta = await table.getFieldMetaById(new_record_fieldId);

    const text_cellvalue = await table.getCellValue(new_record_fieldId, new_record_id);
    // console.log(1, text_cellvalue);

    const text = await table.getCellString(new_record_fieldId, new_record_id);
    // console.log(2, text);

    // 根据字段类型进行文本字符串分隔
    let reg: any = "";
    let text_info: any = text;
    let text_list: any = "";
    let add_field, add_field_id = "";

    switch (field_meta.type) {
      case 1: //Text
        reg_str = new_reg_list.join("|");
        reg = new RegExp(reg_str);

        text_list = text_info.split(reg);
        text_info = text_list.filter(function(item: any) {
          return item && item.trim();
        });
        text_list = text_info;
        break;
      case 19: //Lookup
      case 20: //Formula
        //查找或新建文本字段
        try {  // 获取字段
          add_field = await table.getFieldByName("文本分行（自动添加）");
          add_field_id = add_field.id
        } catch (e) {  // 获取出错后添加字段
          add_field = await table.addField({
            type: FieldType.Text,
            name: "文本分行（自动添加）",
            property: null,
          });
          add_field_id = add_field;
        }

        reg_str = ",| ";
        reg = new RegExp(reg_str);

        text_list = text_info.split(reg);
        text_info = text_list.filter(function(item: any) {
          return item && item.trim();
        });
        text_list = text_info;
        break;
      case 4: //MultiSelect
      case 11: //User
        reg_str = " ";
        reg = new RegExp(reg_str);
        text_list = text_info.split(reg);
        text_info = text_list.filter(function(item: any) {
          return item && item.trim();
        });
        text_list = text_info;
        break;
      case 18: //SingleLink
      case 21: //DuplexLink
        reg_str = ",";
        reg = new RegExp(reg_str);
        text_info = text_cellvalue!.text;
        text_list = text_info.split(reg);
        text_info = text_list.filter(function(item: any) {
          return item && item.trim();
        });
        text_list = text_info;
        break;
      default:
        text_list = "";
        break;
    }

    let text_list_len = text_list.length;
    // console.log(3, text_list);

    const getSelection_recordId: any = getSelection!.recordId;
    const record_items = await table.getRecordById(getSelection_recordId);
    let record_value: any = "";
    let new_text_cellvalue: any = text_cellvalue;
    let record_ids: any = text_cellvalue!.record_ids;

    for (let i = 0; i < text_list_len; i++) {

      // 根据字段类型生成写入的字符串
      switch (field_meta.type) {
        case 1: //Text
          record_value = [{ type: IOpenSegmentType.Text, text: text_list[i] }]
          record_items.fields[new_record_fieldId] = record_value;
          break;
        case 19: //Lookup
        case 20: //Formula
          record_value = [{ type: IOpenSegmentType.Text, text: text_list[i] }]
          record_items.fields[add_field_id] = record_value;
          break;
        case 4: //MultiSelect
        case 11: //User
          record_value = [];
          record_value.push(text_cellvalue[i]);
          record_items.fields[new_record_fieldId] = record_value;
          break;
        case 18: //SingleLink
        case 21: //DuplexLink
          let new_record_ids: any = [];
          new_record_ids.push(record_ids[i]);
          new_text_cellvalue!.record_ids = new_record_ids;
          record_value = new_text_cellvalue;
          record_items.fields[new_record_fieldId] = record_value;
          break;
        default:
          record_value = "";
          record_items.fields[new_record_fieldId] = record_value;
          break;
      }
      // console.log(999, record_value);

      if (op_type === '子记录') {
        let record_id_list: any = [];
        record_id_list.push(getSelection_recordId);
        let record_cellvalue: any = {};
        record_cellvalue = {
          record_ids: record_id_list,
          table_id: getSelection!.tableId,
          text: null,
          type: 'text',
        };
        record_items.fields[fieldId_father] = record_cellvalue;
      }
      await table.addRecord(record_items);
    }
    // console.log(delete_original_record);
    // console.log(delete_original_record.length);
    if (delete_original_record.length !== 0 && delete_original_record[0] !== '') {
      if (op_type === '子记录') {
        alert("子记录模式不允许删除原始记录");
      } else {
        await table.deleteRecord(getSelection_recordId);
      }
    }

    uiBuilder.hideLoading();
    uiBuilder.message.success('文本数据分行完成!');
  });
}