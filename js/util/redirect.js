import Api from "./backend.js";

export async function RedirectToPlatform(platform, newTab = true)
{
    const link = Api.GetLink(platform)

    if(link)
    {
        if(newTab)
            window.open(link, '_blank');
        else
            window.location.href = link;
    }
};
export default RedirectToPlatform;

window.RedirectToPlatform = RedirectToPlatform; 