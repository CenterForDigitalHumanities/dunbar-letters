let tpenProjects = []
let dlaCollection = []
let tpenRecords = []
let dlaRecords = []
let assigneeSet = new Set()
const udelHandlePrefix = "https://udspace.udel.edu/handle/"
const udelRestHandlePrefix = "https://udspace.udel.edu/rest/handle/"
const udelIdPrefix = "https://udspace.udel.edu/rest/items/"
const tpenManifestPrefix = "http://t-pen.org/TPEN/project/"// This is good, but we also need to link into the transcription.html
const tpenProjectPrefix = "http://t-pen.org/TPEN/transcription.html?projectID="// This is good, but we also need to link into the transcription.html
const TPproxy = "http://tinypaul.rerum.io/dla/proxy?url="
let progress = undefined

/**
 * Hey internet, I want the Dunbar Projects out of T-PEN.
 * */
async function getTranscriptionProjects(){  
    await fetch(`cache/tpen.json`)
    //await fetch(`http://165.134.105.25:8181/TPEN28/getDunbarProjects`)
    .then(res=>res.ok?res.json():[])
    .then(projects=>{
        tpenProjects = projects
        let e = new CustomEvent("tpen-information-success", { detail: { projects: projects }, bubbles: true })
        document.dispatchEvent(e)
        return projects
    })
    .catch(err=> {
        console.error(err)
        tpenProjects = []
        let e = new CustomEvent("tpen-information-failure", { detail: { err: err }, bubbles: true })
        document.dispatchEvent(e)
        return []
    })
}

/**
 * Hey internet, I want the DLA items from Delaware.
 * */
async function fetchLetters() {
    dlaCollection = await fetch(`cache/udelShort.json`)
        .then(res => res.ok ? res.json() : [])
        .then(coll => {
            dlaCollection = coll
            let e = new CustomEvent("dla-information-success", { detail: { collection: dlaCollection }, bubbles: true })
            document.dispatchEvent(e)
            return coll
        })
        .catch(err=> {
            console.error(err)
            dlaCollection = {"items":[]}
            let e = new CustomEvent("tpen-information-failure", { detail: { err: err }, bubbles: true })
            document.dispatchEvent(e)
            return []
        })
}



/**
 * Generate the HTML element which will represent the status passed in.  
 * This is for the T-PEN projects items.
 * */
async function generateProjectStatusElement(status, proj){
    let el, statusString, Fcode = ""
    let linkingAnnos, describingAnnos = []
    //Each status handled as its own case.  If we are uniform in what we do we can make this part much shorter if we have a strategic statusesToFind
    switch (status){
        case "T-PEN Project Fully Parsed":
            statusString = `<span class='statusString good'>${status}</span>`
            proj.pages.forEach(page => {
                if(page.numParsedLines < 5){
                    statusString = `<span title='See ${page.page_name}' class='statusString bad'>${status}</span>`
                    return
                }
            })
            el =
            `<dt class="statusLabel" title="Check if there are more than 5 lines with width > 0"> ${statusString} </dt>
            `                               
        break
        case "T-PEN Project Partially Transcribed":
            statusString = `<span class='statusString good'>${status}</span>`
            proj.pages.forEach(page => {
                //We really need to think about this one.
                if(page.numTranscribedLines < 5){
                    statusString = `<span title='See ${page.page_name}' class='statusString bad'>${status}</span>`
                    return
                }
            })
            el =
            `<dt class="statusLabel" title="Check if there are more than 5 lines with width > 0 that have text on each page"> ${statusString} </dt>
            `   
        break
        case "T-PEN Project Fully Transcribed":
            statusString = `<span class='statusString bad'>${status}</span>`
            if(proj.finalized === "true"){
                statusString = `<span class='statusString good'>${status}</span>`
            }
            el =
            `<dt class="statusLabel" title="If there are more than 5 parsed lines on each page, and every line contains text.  Logic performed in servlet and returns T/F."> ${statusString} </dt>
            `   
        break
        case "T-PEN Project Assigned":
            statusString = `<span class='statusString bad'>${status}</span>`
            if(proj.assignees.length && proj.assignees.length > 2){
                for(a of proj.assignees){
                    //a is a T-PEN user ID.  It could be more complex with more info if desired.
                    //This has a.username and a.userid
                    assigneeSet.add(a.username)
                }
                statusString = `<span title="${Array.from(assigneeSet).join(" ")}" class='statusString good'>${status} to ${proj.assignees.length} users </span>`
            }
            el =
            `<dt class="statusLabel" title="Check if it is assigned to at least 2 usera"> ${statusString} </dt>
            `   
        break     
        case "T-PEN Project Linked to Delaware Record(s)":
            linkingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "body.tpenProject.value":""+proj.id})
            statusString = `<span class='statusString bad'>${status}</span>`
            if(linkingAnnos.length>0){
                statusString = `<span class='statusString good'> ${linkingAnnos.length} Linked Record(s)</span>`
            }
            el =
            `<dt class="statusLabel" title="">${statusString}</dt>
            `   
        break
        case "Well Described":
            //This T-PEN project would have to be linked to a UDEL record
            //That linking annotation has a target
            //If it is described, other annos will target that same target
            //Check how many annos target, and define the good/bad threshold. 

            //So there are some testing ones around.  Look for tpenProject.
            linkingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "body.tpenProject.value":""+proj.id})
            describingAnnos = []
            if(linkingAnnos.length > 0){
                describingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "target":linkingAnnos[0].target})
            }
            //Grabbing to anno.targets will tell you what handle
            statusString = `<span class='statusString bad'>${status}</span>`
            if(describingAnnos.length>0){
                statusString = `<span class='statusString good'>${status} by ${describingAnnos.length} data points</span>`
            }
            el =
            `<dt class="statusLabel" title=""> ${statusString} </dt>
            `   
        break
        default:
            el=""
            console.error("Uknown status "+status)
    }
    return el
}

/**
 * Generate the HTML element which will represent the status passed in.  
 * This is for the DLA items.
 * */
async function generateDLAStatusElement(status, item){
    let statusString = ""
    switch (status){
        case "TPEN Project(s) Created":
            //Can we match a T-PEN project to this record?
            statusString = `<span class='statusString bad'>${status}</span>`
            let found = await matchTranscriptionRecords(item)
            if(found.length > 0){
                statusString = `<span title="${found.join()}" class='statusString good'>${found.length} TPEN Projects Found</span>`
            }
            el =
            `<dt class="statusLabel" title=""> ${statusString} </dt>
            ` 
        break
        case "TPEN Project(s) Linked":
            //Not sure what to do here.  The body.tpenProject.value is a projectID.  The target is the RERUM ID for the current item.
            const tpenProjectKeyWildcard = {$exists: true, $type: 'string', $ne: ''}
            statusString = `<span class='statusString bad'>No ${status}</span>`
            let tpenProjectLinkingAnnos = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "body.source.value":udelHandlePrefix+item.handle})
            let tpenProjectIDs = []
            if(tpenProjectLinkingAnnos.length > 0){
                let target = tpenProjectLinkingAnnos[0].target
                let linkedProjects = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "target":target, "body.tpenProject.value":tpenProjectKeyWildcard})
                if(linkedProjects.length > 0){
                    for(tpenAnno of linkedProjects){
                        tpenProjectIDs.push(tpenProjectLinkingAnnos.body.tpenProject.value)
                    }
                    statusString = `<span title='See ${tpenProjectIDs.join()}' class='statusString good'>${tpenProjectIDs.length} ${status}</span>`
                    
                }
            }
            el =`<dt class="statusLabel" title=""> ${statusString} </dt>`
        break
        case "Delaware Record Linked":
            statusString = `<span class='statusString bad'>${status}</span>`
            let recordHandleAnnos2 = await fetchQuery({$or:[{"@type":"Annotation"}, {"type":"Annotation"}], "body.source.value":udelHandlePrefix+item.handle})
            if(recordHandleAnnos2.length > 0){
                statusString = `<span title='See ${recordHandleAnnos2[0]["@id"]}' class='statusString good'>${status}</span>`
            }
            el =
            `<dt class="statusLabel" title=""> ${statusString} </dt>`
        break
        case "Envelope Linked":
            //This is probably a T-PEN check, not sure. Can we check for an annotation with body that is a certain name or a primitive name of some kind?
            // statusString = "<span class='statusString bad'>Under Development!</span>"
            // el =
            // `<dt class="statusLabel" title=""> ${statusString} </dt>`
            el=``
        break
        default:
            el=``
            console.error("Uknown status "+status)
    }
    return el
}

/**
 * Perform a tiny query against the query parameter object passed in.
 * */
async function fetchQuery(params){
    const historyWildcard = { $exists: true, $type: 'array', $eq: [] }
    let query = {
        "__rerum.history.next": historyWildcard
    }
    let queryObj = Object.assign(query, params)
    return fetch("http://tinydev.rerum.io/app/query?limit=100&skip=0", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
}

function getFolderFromMetadata(metaMap){
    let ok = false
    for (const m of metaMap) {
        if (m.key === "dc.identifier.other") { 
            ok = true
            return m.value 
        }
    }
    if(!ok){
        console.error("No dc.identifier.other in metadata")
        console.log(metaMap)
    }
}

/**
 *  You have a DLA Item F-Code known from a project ID.  Get the DLA record(s) that have a matching F-Code in their metadata.
 * */
async function findUdelRecordWithCode(Fcode, projID) {
    // This is the Fcode that the TPEN project knew, like F158
    // Need to check that there is a udel item with this Fcode, looking through letters collection.
    let match = false
    let impossible = false;
    let itemHandle = ""
    for(item of dlaCollection.items){
        const metadataUri = `http://tinypaul.rerum.io/dla/proxy?url=${udelRestHandlePrefix+item.handle}?expand=metadata`    
        match = await fetch(metadataUri)
            .then(res => res.ok ? res.json() : Promise.reject(res))
            .then(meta => getFolderFromMetadata(meta.metadata))
            .then(folderString => {
                if(folderString !== undefined && folderString.indexOf(" F") > -1){
                    return folderString.split(" F").pop()
                }
                else{
                    //This DLA item does not have dc.identifier.other, so there is no connected Fcode
                    impossible = true
                    return ""
                }
            }) // Like "Box 3, F4"
            .then(folderNumber => {
                const matchStr = `F${folderNumber.padStart(3, '0')}`
                return Fcode === matchStr
            })
        if(match){
            itemHandle = udelHandlePrefix+item.handle
            return
        }    
        if(impossible){
            console.error("Could not determine folder name for "+udelHandlePrefix+item.handle+"?expand=metadata.  That means this TPEN project "+projID+" cannot determine if a udel record exists for code "+Fcode+".  We are skipping the check for this project.")
            return
        }
    }
    return itemHandle
}

/**
 * You have a DLA record.  You would like to see if any transcription projects are created that are about this record.
 * Note this does not detect that record and project(s) are specifically linked yet.
 * */
async function matchTranscriptionRecords(dlaRecord) {
    const metadataUri = `http://tinypaul.rerum.io/dla/proxy?url=${udelRestHandlePrefix+dlaRecord.handle}?expand=metadata`
    return await fetch(metadataUri)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(meta => getFolderFromMetadata(meta.metadata))
        .then(folderString => folderString.split(" F").pop()) // Like "Box 3, F4"
        .then(folderNumber => {
            const matchStr = `F${folderNumber.padStart(3, '0')}`
            let matches = []
            for (const f of tpenProjects) {
                if (f.collection_code === matchStr) { 
                    matches.push(f.id) 
                }
            }
            return matches
        })
        .catch(err => {return []})
}

/**
 * Render a filterable scrollable area to go over the status of each DLA item or each  T-PEN project
 * or possibly a combinations. 
 * */
async function loadInterfaceDLA() {
    let dlaAreaElem = document.getElementById("dla_browsable")
    // dlaAreaElem.innerHTML = `
    //     <div id="DLADocuments" class="grow wrap">list loading</div>
    //     <div class="sidebar">
    //         <h3>Refine Results <button role="button" id="dlaQueryReset">clear all</button></h3>
    //         <progress value="107" max="107">107 of 107</progress>
    //         <input id="query" type="text" placeholder="type to filter">
    //         <section id="dlaFacetFilter"></section>
    //     </div>
    // `

    const DLA_FIELDS = [
        "name", "id", "handle"
        //"Author", "Subjects", "Publisher", "Language", 
        //"Date Issued", "Box ID", "Number of Pages",
        //"Collection ID", "Unique ID"
        // script, decoration, physical description
    ]

    const DLA_FILTERS = {
        Status: "statuses"
    }


    const DLA_SEARCH =[
        "name", "id", "handle"
        //"Author", "Subjects", "Publisher", "Language", 
        //"Date Issued", "Box ID", "Number of Pages",
        //"Collection ID", "Unique ID"
        // script, decoration, physical description
    ]

    const statusesToFind = [
        "Delaware Record Linked",
        "TPEN Project(s) Created",
        "TPEN Project(s) Linked",
        "Envelope Linked"
    ]

    document.getElementById("DLADocuments").innerHTML = ""

    for(record of dlaCollection.items){
        let statusListElements = ``
        let statusListAttributes = new Array()
        for(status of statusesToFind){
            //Note that the assignee status will populate the assigneeSet
            let el = await generateDLAStatusElement(status, record)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        document.getElementById("DLADocuments").innerHTML += `
            <div class="dlaRecord record" data-id="${TPproxy+udelIdPrefix+record.id}?expand=metadata" >
            <h3><a target="_blank" href="${udelIdPrefix+record.id}">${record.name}</a></h3>
            <!--
            <div class="row">
                <dl>
                </dl>
            </div>
            -->
            <div class="row">
                <dl>
                    ${statusListElements}
                </dl>
            </div>
        </div>
        `
    }

    dlaRecords = document.querySelectorAll(".dlaRecord")
    let dla_loading = []
    let statusSet = new Set();
    statusSet.add("Delaware Record Linked")
    statusSet.add("TPEN Project(s) Created")
    statusSet.add("TPEN Project(s) Linked")
    statusSet.add("Envelope Linked")
    let dla_facets = {
        "status":statusSet
    }

    Array.from(dlaRecords).forEach(r => {
        const url = r.getAttribute("data-id")
        let dl = ``
        dla_loading.push(fetch(url)
            .then(status => { if (!status.ok) { throw Error(status) } return status })
            .then(response => response.json())
            .then(dlaRecordInfo => {
                let metadataMap = new Map()
                dlaRecordInfo.metadata?.forEach(dat => {
                    metadataMap.set(dat.label, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                    if((Array.isArray(dat.value) && dat.value.length > 1) || dat.value.trim() !== ""){
                        //No blanks
                        metadataMap.set(dat.label, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                    }
                    if (DLA_FIELDS.includes(dat.label)) {
                        //don't need to show any of these for the status.  Label is already showing.
                        //dl += `<dt class="uppercase">${dat.label}</dt><dd>${metadataMap.get(dat.label)}</dd>`
                    }
                })
                r.setAttribute("data-query", DLA_SEARCH.reduce((a, b) => a += (metadataMap.has(b) ? metadataMap.get(b) : "*") + " ", ""))
                //r.querySelector("dl").innerHTML = dl
            })
            .catch(err => { throw Error(err) })
        )
    })
    document.getElementById("dla_query").addEventListener("input", filterQuery)
    return Promise.all(dla_loading).then(() => populateSidebar(dla_facets, DLA_FILTERS, "dla")).catch(err=>console.error(err))
}

/**
 * Render a filterable scrollable area to go over the status of each DLA item or each  T-PEN project
 * or possibly a combinations. 
 * */
async function loadInterfaceTPEN() {
    assigneeSet = new Set()
    let tpenAreaElem = document.getElementById("tpen_browsable")

    // tpenAreaElem.innerHTML = `
    //     <div id="TPENDocuments" class="grow wrap">list loading</div>
    //     <div class="sidebar">
    //         <h3>Refine Results <button role="button" id="tpenQueryReset">clear all</button></h3>
    //         <progress value="107" max="107">107 of 107</progress>
    //         <input id="tpen_query" type="text" placeholder="type to filter">
    //         <section id="tpenFacetFilter"></section>
    //     </div>
    // `
    const TPEN_FIELDS = [
        "title", "subtitle", "subject", "date", "language",
        "author", "description", "location"
    ]

    const TPEN_FILTERS = {
        Status: "status",
        Assignee : "assignees"
    }

    // const TPEN_FILTERS = {
    //     T-PEN Project Fully Parsed: "false", T-PEN Project Assigned: "false", T-PEN Project Partially Transcribed:"false",
    //     T-PEN Project Fully Transcribed: "false", T-PEN Project Linked to Delaware Record(s):"false", Well Described:"false"
    // }

    const TPEN_SEARCH = [
        "title", "subtitle", "subject", "date", "language",
        "author", "description", "location"
    ]

    const statusesToFind = [
        "T-PEN Project Fully Parsed",
        "T-PEN Project Assigned",
        "T-PEN Project Partially Transcribed",
        "T-PEN Project Fully Transcribed",
        "T-PEN Project Linked to Delaware Record(s)",
        "Well Described"
    ]

    document.getElementById("TPENDocuments").innerHTML = ""
    for(proj of tpenProjects){
        let statusListElements = ``
        let statusListAttributes = new Array()
        for(status of statusesToFind){
            //Note that the assignee status will populate the assigneeSet
            let el = await generateProjectStatusElement(status, proj)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        document.getElementById("TPENDocuments").innerHTML += `
            <div class="tpenRecord record" data-id="${tpenManifestPrefix+proj.id}" 
              data-assignees="${Array.from(assigneeSet).join(" ")}" 
              data-status="${statusListAttributes.join(" ")}"
            >
            <h3><a target="_blank" href="${tpenProjectPrefix+proj.id}">${proj["metadata_name"]}</a></h3>
            <!--
            <div class="row">
                <dl>
                </dl>
            </div>
            -->
            <div class="row">
                <img class="thumbnail" src="${proj.thumbnail}" >
                <dl>
                    ${statusListElements}
                </dl>
            </div>
        </div>
        `
    }

    tpenRecords = document.querySelectorAll(".tpenRecord")
    let tpen_loading = []
    let statusSet = new Set();
    statusSet.add("T-PEN Project Fully Parsed")
    statusSet.add("T-PEN Project Assigned")
    statusSet.add("T-PEN Project Partially Transcribed")
    statusSet.add("T-PEN Project Fully Transcribed")
    statusSet.add("T-PEN Project Linked to Delaware Record(s)")
    statusSet.add("Well Described")
    let tpen_facets = {
        "status":statusSet,
        "assignees":assigneeSet
    }
    Array.from(tpenRecords).forEach(r => {
        const url = r.getAttribute("data-id")
        let dl = ``
        tpen_loading.push(fetch(url)
            .then(status => { if (!status.ok) { throw Error(status) } return status })
            .then(response => response.json())
            .then(tpenProject => {
                let metadataMap = new Map()
                tpenProject.metadata?.forEach(dat => {
                    //Note this does not know the Project.name, it knows the Metadata.title
                    if((Array.isArray(dat.value) && dat.value.length > 1) || dat.value.trim() !== ""){
                        //No blanks
                        metadataMap.set(dat.label, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                    }
                    if (TPEN_FIELDS.includes(dat.label)) {
                        //don't need to show any of these for the status.  Label is already showing.
                        //dl += `<dt class="uppercase">${dat.label}</dt><dd>${metadataMap.get(dat.label)}</dd>`
                    }
                })
                //Here we aren't filtering by metadata, so we don't need to build facets off the metadata
                r.setAttribute("data-query", TPEN_SEARCH.reduce((a, b) => a += (metadataMap.has(b) ? metadataMap.get(b) : "*") + " ", ""))
                //Not building this dl object out right now
                //r.querySelector("dl").innerHTML = dl
            })
            .catch(err => { throw Error(err) })
        )
    })
    document.getElementById("tpen_query").addEventListener("input", filterQuery)
    return Promise.all(tpen_loading).then(() => populateSidebar(tpen_facets, TPEN_FILTERS, "tpen")).catch(err=>console.error(err))
}

function populateSidebar(facets, filters, which) {
    //The facet needs to be <facet data-facet="status" data-label="T-PEN Project Fully Parsed" data-count="1"> for each status to filter by.
    let side = `<ul>`
    let elemRoot = document.getElementById(which+"_browsable")
    for (const f in filters) {
        if (!facets[filters[f]]) continue
        side += `<li>${f}</li>`
        side += Array.from(facets[filters[f]]).reduce((a, b) => a += `<facet data-facet="${filters[f]}" data-label="${b}">${b}</facet>`, ``)
    }
    side += `</ul>`
    let facetFilter = document.getElementById(which+"FacetFilter")
    facetFilter.innerHTML = side
    let facetsElements = elemRoot.querySelectorAll("[data-facet]")
    Array.from(facetsElements).forEach(el => el.addEventListener("click", filterFacets))
    updateCount(which)
    loadQuery(which)
}

function updateCount(which) {
    // let visibleCount = Array.from(records).filter(el=>el.offsetParent === null).length
    let elemRoot = document.getElementById(which+"_browsable")
    let records = document.getElementsByClassName(which+"Record")
    let hiddenCount = elemRoot.querySelectorAll(".record[class*='hide-']").length
    let queryInput = document.getElementById(which+"_query")
    let countBar = queryInput.previousElementSibling
    let countBarValue = records.length - hiddenCount
    countBar.max = records.length
    countBar.textContent = countBarValue + " of " + countBar.max
    if(progress != undefined){
       clearInterval(progress) 
    }
    const notzero = countBarValue > countBar.value ? 1 : -1
    let step = parseInt((countBarValue - countBar.value) / 25) || notzero
    progress = setInterval(() => {
        countBar.value += step
        if (Math.abs(countBar.value - countBarValue) < 2) {
            countBar.value = countBarValue
            clearInterval(progress)
        }
    }, 10)
    let facetsElements = elemRoot.querySelectorAll("facet")
    Array.from(facetsElements).forEach(f => {
        const k = f.getAttribute("data-facet")
        const v = f.textContent
        let count = elemRoot.querySelectorAll(".record:not([class*='hide-'])[data-" + k + "*='" + v + "']").length
        f.setAttribute("data-count", count)
        // if (count === 0) {
        //     f.classList.add("hide-sidebar")
        // } else {
        //     f.classList.remove("hide-sidebar")
        // }
    })
}

const loadQuery = (which) => {
    const params = new URLSearchParams(location.search)
    let queryInput = document.getElementById(which+"_query")
    let elemRoot = document.getElementById(which+"_browsable")
    params.forEach((v,k)=>{
        elemRoot.querySelectorAll(`[data-facet="${k}"][data-label="${v}"]`)
         .forEach(el=>el.click())
    })
    const queryString = params.get("q")

    if(queryString){
        queryInput.value = queryString
        queryInput.dispatchEvent(new Event('input'))
    }
}

if (window.tpenQueryReset) {
    tpenQueryReset.addEventListener("click", ev => {
        Array.from(document.getElementById("tpen_browsable").querySelectorAll(".clicked")).forEach(el => el.dispatchEvent(new Event("click")))
        document.getElementById("tpen_query").value = ""
        document.getElementById("tpen_query").dispatchEvent(new Event("input"))
    })
}

if (window.dlaQueryReset) {
    dlaQueryReset.addEventListener("click", ev => {
        Array.from(document.getElementById("dla_browsable").querySelectorAll(".clicked")).forEach(el => el.dispatchEvent(new Event("click")))
        document.getElementById("dla_query").value = ""
        document.getElementById("dla_query").dispatchEvent(new Event("input"))
    })
}

function filterQuery(event) {
    const queryString = event.target.value
    let which = event.target.id.replace("_query","")
    let records = document.getElementsByClassName(which+"Record")
    Array.from(records).forEach(r => new RegExp(queryString, "i").test(r.getAttribute("data-query")) ? r.classList.remove("hide-query") : r.classList.add("hide-query"))
    //Manuscripts.querySelectorAll(".record:not([data-query*='"+queryString+"'])")
    updateCount(which)
}
function filterFacets(event) {
    let which = event.target.closest("section").id.replace("FacetFilter", "")
    const clicked = event.target
    clicked.classList.toggle("clicked")
    const action = clicked.classList.contains("clicked") ? "add" : "remove"
    const k = clicked.getAttribute("data-facet")
    const v = clicked.textContent
    let records = document.getElementsByClassName(which+"Record")
    Array.from(records).forEach(r => { if (!new RegExp(v, "i").test(r.getAttribute("data-" + k))) r.classList[action]("hide-facet") })
    updateCount(which)
}