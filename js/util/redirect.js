import Api from "./backend.js";

export async function RedirectToPlatform(platform, newTab = true)
{
    const link = await Api.GetLink(platform)

    if(link)
    {
        if(newTab)
            // noopener kills reverse-tabnabbing; noreferrer stops the target from learning
            // the current URL (which might contain license material like ?showKeys=).
            window.open(link, '_blank', 'noopener,noreferrer');
        else
            window.location.href = link;
    }
};
export default RedirectToPlatform;

window.RedirectToPlatform = RedirectToPlatform; 