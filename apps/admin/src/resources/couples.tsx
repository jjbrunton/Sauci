import {
    List,
    Datagrid,
    TextField,
    DateField,
    TextInput,
} from 'react-admin';

const coupleFilters = [
    <TextInput key="invite" label="Invite Code" source="invite_code" alwaysOn />,
];

export const CoupleList = () => (
    <List filters={coupleFilters}>
        <Datagrid bulkActionButtons={false}>
            <TextField source="id" label="Couple ID" />
            <TextField source="invite_code" label="Invite Code" />
            <DateField source="created_at" label="Created" />
        </Datagrid>
    </List>
);
