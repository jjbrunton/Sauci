import { List, Datagrid, TextField, BooleanField, EditButton, Create, SimpleForm, TextInput, BooleanInput, Edit } from 'react-admin';

export const PackList = () => (
    <List>
        <Datagrid rowClick="edit">
            <TextField source="name" />
            <TextField source="description" />
            <BooleanField source="is_premium" />
            <BooleanField source="is_public" />
            <EditButton />
        </Datagrid>
    </List>
);

export const PackEdit = () => (
    <Edit>
        <SimpleForm>
            <TextInput source="name" />
            <TextInput source="description" multiline />
            <TextInput source="icon" />
            <BooleanInput source="is_premium" />
            <BooleanInput source="is_public" />
            <TextInput source="sort_order" />
        </SimpleForm>
    </Edit>
);

export const PackCreate = () => (
    <Create>
        <SimpleForm>
            <TextInput source="name" />
            <TextInput source="description" multiline />
            <TextInput source="icon" />
            <BooleanInput source="is_premium" />
            <BooleanInput source="is_public" />
            <TextInput source="sort_order" />
        </SimpleForm>
    </Create>
);
