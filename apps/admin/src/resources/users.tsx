import { List, Datagrid, TextField, BooleanField, DateField, ReferenceField } from 'react-admin';

export const ProfileList = () => (
    <List>
        <Datagrid>
            <TextField source="name" />
            <TextField source="email" />
            <BooleanField source="is_premium" />
            <ReferenceField source="couple_id" reference="couples">
                <TextField source="id" />
            </ReferenceField>
            <DateField source="created_at" />
        </Datagrid>
    </List>
);

export const ResponseList = () => (
    <List>
        <Datagrid>
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
