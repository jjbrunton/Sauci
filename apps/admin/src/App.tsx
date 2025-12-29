import { Admin, Resource } from "react-admin";
import { auditDataProvider } from "./providers/auditDataProvider";
import { PackList, PackEdit, PackCreate } from "./resources/packs";
import { QuestionList, QuestionEdit, QuestionCreate } from "./resources/questions";
import { ProfileList, ProfileShow, ProfileEdit, ResponseList } from "./resources/users";
import { CoupleList } from "./resources/couples";
import { MatchList, MatchShow } from "./resources/matches";
import { AuditLogList } from "./resources/auditLogs";
import { authProvider, AdminPermissions } from "./providers/authProvider";

const App = () => (
    <Admin
        dataProvider={auditDataProvider}
        authProvider={authProvider}
        requireAuth
    >
        {(permissions: AdminPermissions) => (
            <>
                {/* Question Packs - accessible to all admins */}
                <Resource
                    name="question_packs"
                    list={PackList}
                    edit={PackEdit}
                    create={PackCreate}
                    recordRepresentation="name"
                    options={{ label: 'Question Packs' }}
                />

                {/* Questions - accessible to all admins */}
                <Resource
                    name="questions"
                    list={QuestionList}
                    edit={QuestionEdit}
                    create={QuestionCreate}
                    options={{ label: 'Questions' }}
                />

                {/* Super admin only resources */}
                {permissions?.role === 'super_admin' && (
                    <>
                        <Resource
                            name="profiles"
                            list={ProfileList}
                            show={ProfileShow}
                            edit={ProfileEdit}
                            recordRepresentation="name"
                            options={{ label: 'Users' }}
                        />
                        <Resource
                            name="couples"
                            list={CoupleList}
                            options={{ label: 'Relationships' }}
                        />
                        <Resource
                            name="matches"
                            list={MatchList}
                            show={MatchShow}
                            options={{ label: 'Matches & Chats' }}
                        />
                        <Resource
                            name="responses"
                            list={ResponseList}
                            options={{ label: 'Responses' }}
                        />
                        <Resource
                            name="messages"
                            options={{ label: 'Messages' }}
                        />
                        <Resource
                            name="audit_logs"
                            list={AuditLogList}
                            options={{ label: 'Audit Logs' }}
                        />
                    </>
                )}
            </>
        )}
    </Admin>
);

export default App;
