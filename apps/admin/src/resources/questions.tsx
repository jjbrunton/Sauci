import {
    List,
    Datagrid,
    TextField,
    ReferenceField,
    NumberField,
    EditButton,
    Create,
    SimpleForm,
    TextInput,
    NumberInput,
    ReferenceInput,
    SelectInput,
    Edit,
    CheckboxGroupInput,
    ArrayField,
    ChipField,
    SingleFieldList,
    BooleanField,
    FunctionField,
} from 'react-admin';
import { Typography, Box, Chip, Tooltip, IconButton } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const COUPLE_GENDER_CHOICES = [
    { id: 'male+female', name: 'Male + Female' },
    { id: 'male+male', name: 'Male + Male' },
    { id: 'female+female', name: 'Female + Female' },
];

const TARGET_USER_GENDER_CHOICES = [
    { id: 'male', name: 'Male' },
    { id: 'female', name: 'Female' },
    { id: 'non-binary', name: 'Non-binary' },
    { id: 'prefer-not-to-say', name: 'Prefer not to say' },
];

const LabelWithTooltip = ({ label, tooltip }: { label: string; tooltip: string }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography component="span">{label}</Typography>
        <Tooltip title={tooltip} arrow placement="right">
            <IconButton size="small" sx={{ p: 0.25 }}>
                <HelpOutlineIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            </IconButton>
        </Tooltip>
    </Box>
);

const GenderChips = ({ record, source }: { record?: any; source: string }) => {
    const values = record?.[source];
    if (!values || values.length === 0) {
        return <Chip label="All" size="small" variant="outlined" />;
    }
    return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {values.map((v: string) => (
                <Chip key={v} label={v} size="small" />
            ))}
        </Box>
    );
};

export const QuestionList = () => (
    <List>
        <Datagrid rowClick="edit">
            <TextField source="text" />
            <ReferenceField source="pack_id" reference="question_packs">
                <TextField source="name" />
            </ReferenceField>
            <NumberField source="intensity" />
            <FunctionField
                label="Two-part"
                render={(record: any) => record?.partner_text ? 'Yes' : 'No'}
            />
            <FunctionField
                label="Target Users"
                render={(record: any) => {
                    const values = record?.target_user_genders;
                    if (!values || values.length === 0) return 'All';
                    return values.join(', ');
                }}
            />
            <EditButton />
        </Datagrid>
    </List>
);

const QuestionForm = () => (
    <SimpleForm>
        <ReferenceInput source="pack_id" reference="question_packs">
            <SelectInput optionText="name" />
        </ReferenceInput>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Question Text
        </Typography>
        <TextInput
            source="text"
            multiline
            fullWidth
            helperText="Primary text shown to the initiator (first person to see this question)"
        />
        <TextInput
            source="partner_text"
            multiline
            fullWidth
            helperText="Optional: Text shown to the partner after the initiator has answered. Leave blank for single-text questions."
        />

        <NumberInput source="intensity" min={1} max={5} />

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
            Targeting
        </Typography>

        <CheckboxGroupInput
            source="target_user_genders"
            label={
                <LabelWithTooltip
                    label="Show to (as initiator)"
                    tooltip="The 'initiator' is the first person in the couple to see and answer a question. This filter controls which genders can be the initiator. Their partner will always see the question after the initiator answers, regardless of this setting."
                />
            }
            choices={TARGET_USER_GENDER_CHOICES}
            helperText="Leave empty to show to all genders as initiator."
        />

        <CheckboxGroupInput
            source="allowed_couple_genders"
            label={
                <LabelWithTooltip
                    label="Couple types"
                    tooltip="Filters which couple compositions can see this question. A 'male+female' couple has one male and one female partner. This ensures questions are only shown to couples where the content is relevant to their relationship dynamic."
                />
            }
            choices={COUPLE_GENDER_CHOICES}
            helperText="Leave empty to show to all couple types."
        />
    </SimpleForm>
);

export const QuestionEdit = () => (
    <Edit>
        <QuestionForm />
    </Edit>
);

export const QuestionCreate = () => (
    <Create>
        <QuestionForm />
    </Create>
);
