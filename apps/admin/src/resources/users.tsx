import {
    List,
    Datagrid,
    TextField,
    BooleanField,
    DateField,
    ReferenceField,
    Edit,
    SimpleForm,
    TextInput,
    BooleanInput,
    ReferenceInput,
    SelectInput,
    Show,
    SimpleShowLayout,
    ReferenceManyField,
    useRecordContext,
    TabbedShowLayout,
} from 'react-admin';

export const ProfileList = () => (
    <List>
        <Datagrid rowClick="show">
            <TextField source="name" />
            <BooleanField source="is_premium" />
            <ReferenceField source="couple_id" reference="couples" link={false}>
                <TextField source="id" />
            </ReferenceField>
            <DateField source="created_at" />
        </Datagrid>
    </List>
);

export const ProfileShow = () => (
    <Show>
        <TabbedShowLayout>
            <TabbedShowLayout.Tab label="Profile">
                <TextField source="id" />
                <TextField source="name" />
                <BooleanField source="is_premium" />
                <ReferenceField source="couple_id" reference="couples">
                    <TextField source="invite_code" />
                </ReferenceField>
                <DateField source="created_at" />
            </TabbedShowLayout.Tab>

            <TabbedShowLayout.Tab label="Matches & Chats">
                <ReferenceManyField
                    label="Matches"
                    reference="matches"
                    target="couple_id"
                    source="couple_id"
                >
                    <Datagrid rowClick="show" bulkActionButtons={false}>
                        <ReferenceField source="question_id" reference="questions">
                            <TextField source="text" />
                        </ReferenceField>
                        <TextField source="match_type" />
                        <BooleanField source="is_new" label="Unread" />
                        <DateField source="created_at" />
                    </Datagrid>
                </ReferenceManyField>
            </TabbedShowLayout.Tab>

            <TabbedShowLayout.Tab label="Responses">
                <ReferenceManyField
                    label="Responses"
                    reference="responses"
                    target="user_id"
                >
                    <Datagrid bulkActionButtons={false}>
                        <ReferenceField source="question_id" reference="questions">
                            <TextField source="text" />
                        </ReferenceField>
                        <TextField source="answer" />
                        <DateField source="created_at" />
                    </Datagrid>
                </ReferenceManyField>
            </TabbedShowLayout.Tab>
        </TabbedShowLayout>
    </Show>
);

export const ProfileEdit = () => (
    <Edit>
        <SimpleForm>
            <TextInput source="name" />
            <BooleanInput source="is_premium" label="Premium Status" />
            <ReferenceInput source="couple_id" reference="couples">
                <SelectInput optionText="id" />
            </ReferenceInput>
        </SimpleForm>
    </Edit>
);

export const ResponseList = () => (
    <List>
        <Datagrid bulkActionButtons={false}>
            <ReferenceField source="user_id" reference="profiles">
                <TextField source="name" />
            </ReferenceField>
            <ReferenceField source="question_id" reference="questions">
                <TextField source="text" />
            </ReferenceField>
            <TextField source="answer" />
            <DateField source="created_at" />
        </Datagrid>
    </List>
);
