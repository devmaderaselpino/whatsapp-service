import { format } from "@formkit/tempo";

const mazatlanHora = () => {
    return format({
        date: new Date(),
        format: 'YYYY-MM-DD HH:mm:ss',
        tz: 'America/Mazatlan'
    });
}
export default mazatlanHora;
