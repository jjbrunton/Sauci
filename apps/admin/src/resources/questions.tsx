import { List, Datagrid, TextField, ReferenceField, NumberField, EditButton, Create, SimpleForm, TextInput, NumberInput, ReferenceInput, SelectInput, Edit } from 'react-admin';

export const QuestionList = () => (
    <List>
        <Datagrid rowClick="edit">
            <TextField source="text" />
            <ReferenceField source="pack_id" reference="question_packs">
                <TextField source="name" />
            </ReferenceField>
            <NumberField source="intensity" />
            <EditButton />
        </Datagrid>
    </List>
);

export const QuestionEdit = () => (
    <Edit>
        <SimpleForm>
            <ReferenceInput source="pack_id" reference="question_packs">
                <SelectInput optionText="name" />
            </ReferenceInput>
            <TextInput source="text" multiline fullWidth />
            <NumberInput source="intensity" min={1} max={5} />
        </SimpleForm>
    </Edit>
);

export const QuestionCreate = () => (
    <Create>
        <SimpleForm>
            <ReferenceInput source="pack_id" reference="question_packs">
                <SelectInput optionText="name" />
            </ReferenceInput>
            <TextInput source="text" multiline fullWidth />
            <NumberInput source="intensity" min={1} max={5} />
        </SimpleForm>
    </Create>
);
