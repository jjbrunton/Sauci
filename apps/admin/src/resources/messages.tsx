import {
    List,
    Datagrid,
    TextField,
    DateField,
    ReferenceField,
    TextInput,
} from 'react-admin';

const messageFilters = [
    <TextInput key="content" label="Search content" source="content@ilike" alwaysOn />,
];

export const MessageList = () => (
    <List filters={messageFilters} sort={{ field: 'created_at', order: 'DESC' }}>
        <Datagrid bulkActionButtons={false}>
            <ReferenceField source="user_id" reference="profiles" label="Sender">
                <TextField source="name" />
            </ReferenceField>
            <TextField source="content" />
            <DateField source="created_at" showTime label="Sent At" />
            <DateField source="read_at" showTime label="Read At" />
        </Datagrid>
    </List>
);
