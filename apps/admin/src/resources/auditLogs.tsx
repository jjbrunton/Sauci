import {
    List,
    Datagrid,
    TextField,
    DateField,
    FunctionField,
    SelectInput,
    TextInput,
    DateInput,
} from 'react-admin';

const auditLogFilters = [
    <TextInput key="table" label="Table" source="table_name" alwaysOn />,
    <SelectInput
        key="action"
        source="action"
        choices={[
            { id: 'INSERT', name: 'Create' },
            { id: 'UPDATE', name: 'Update' },
            { id: 'DELETE', name: 'Delete' },
        ]}
    />,
    <DateInput key="from" source="created_at@gte" label="From Date" />,
    <DateInput key="to" source="created_at@lte" label="To Date" />,
];

export const AuditLogList = () => (
    <List
        filters={auditLogFilters}
        sort={{ field: 'created_at', order: 'DESC' }}
    >
        <Datagrid bulkActionButtons={false}>
            <DateField source="created_at" showTime label="Timestamp" />
            <TextField source="table_name" label="Table" />
            <FunctionField
                label="Action"
                render={(record: { action: string }) => {
                    const actionMap: Record<string, string> = {
                        INSERT: 'Create',
                        UPDATE: 'Update',
                        DELETE: 'Delete',
                    };
                    return actionMap[record.action] || record.action;
                }}
            />
            <TextField source="record_id" label="Record ID" />
            <TextField source="admin_role" label="Role" />
            <FunctionField
                label="Changed Fields"
                render={(record: { changed_fields?: string[] }) =>
                    record.changed_fields?.join(', ') || '-'
                }
            />
            <FunctionField
                label="Summary"
                render={(record: { action: string; changed_fields?: string[] }) => {
                    if (record.action === 'INSERT') return 'New record created';
                    if (record.action === 'DELETE') return 'Record deleted';
                    return `${record.changed_fields?.length || 0} fields changed`;
                }}
            />
        </Datagrid>
    </List>
);
