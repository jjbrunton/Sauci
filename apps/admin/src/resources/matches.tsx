import {
    Show,
    SimpleShowLayout,
    TextField,
    DateField,
    ReferenceField,
    ReferenceManyField,
    List,
    Datagrid,
    BooleanField,
    Labeled,
} from 'react-admin';

export const MatchShow = () => (
    <Show>
        <SimpleShowLayout>
            <TextField source="id" label="Match ID" />
            <ReferenceField source="question_id" reference="questions" label="Question">
                <TextField source="text" />
            </ReferenceField>
            <TextField source="match_type" />
            <BooleanField source="is_new" label="Unread" />
            <DateField source="created_at" />

            <Labeled label="Chat Messages" fullWidth>
                <ReferenceManyField
                    reference="messages"
                    target="match_id"
                    sort={{ field: 'created_at', order: 'ASC' }}
                >
                    <Datagrid bulkActionButtons={false}>
                        <ReferenceField source="user_id" reference="profiles" link={false}>
                            <TextField source="name" />
                        </ReferenceField>
                        <TextField source="content" label="Message" />
                        <DateField source="created_at" showTime label="Sent" />
                        <DateField source="read_at" showTime label="Read" emptyText="-" />
                    </Datagrid>
                </ReferenceManyField>
            </Labeled>
        </SimpleShowLayout>
    </Show>
);

export const MatchList = () => (
    <List>
        <Datagrid rowClick="show" bulkActionButtons={false}>
            <ReferenceField source="couple_id" reference="couples" link={false}>
                <TextField source="id" />
            </ReferenceField>
            <ReferenceField source="question_id" reference="questions">
                <TextField source="text" />
            </ReferenceField>
            <TextField source="match_type" />
            <BooleanField source="is_new" label="Unread" />
            <DateField source="created_at" />
        </Datagrid>
    </List>
);
