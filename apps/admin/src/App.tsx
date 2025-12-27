import { Admin, Resource } from "react-admin";
import { dataProvider } from "./providers/supabaseProvider";
import { PackList, PackEdit, PackCreate } from "./resources/packs";
import { QuestionList, QuestionEdit, QuestionCreate } from "./resources/questions";
import { ProfileList, ResponseList } from "./resources/users";
import { authProvider } from "./providers/authProvider";

const App = () => (
    <Admin dataProvider={dataProvider} authProvider={authProvider} requireAuth>
        <Resource
            name="question_packs"
            list={PackList}
            edit={PackEdit}
            create={PackCreate}
            recordRepresentation="name"
        />
        <Resource
            name="questions"
            list={QuestionList}
            edit={QuestionEdit}
            create={QuestionCreate}
        />
        <Resource
            name="profiles"
            list={ProfileList}
        />
        <Resource
            name="responses"
            list={ResponseList}
        />
        <Resource name="couples" />
    </Admin>
);

export default App;
