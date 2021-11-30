let tpenProjects = []
let dlaCollection = []
let tpenRecords = []
let dlaRecords = []
const udelHandlePrefix = "https://udspace.udel.edu/rest/handle/"
const udelIdPrefix = "https://udspace.udel.edu/rest/items/"
const tpenProjectPrefix = "http://t-pen.org/TPEN/project/"// This is good, but we also need to link into the transcription.html
const TPproxy = "http://tinypaul.rerum.io/dla/proxy?url="
let progress = undefined

/**
 * Hey internet, I want the Dunbar Projects out of T-PEN.
 * */
async function getTranscriptionProjects(){
    tpenProjects =  
    await fetch(`cache/tpenShort.json`)
    //await fetch(`http://165.134.105.25:8181/TPEN28/getDunbarProjects`)
    .then(res=>res.ok?res.json():[])
    .then(projects=>{
        let e = new CustomEvent("tpen-information-success", { "detail:" { "projects": projects }, "bubbles": true })
        document.dispatchEvent(e)
        return projects
    })
    .catch(err=> {
        console.error(err)
        let e = new CustomEvent("tpen-information-failure", { "detail": { "err": err }, "bubbles": true })
        document.dispatchEvent(e)
        return projects
        return []
    })
}

/**
 * Hey internet, I want the DLA items from Delaware.
 * */
async function fetchLetters() {
    dlaCollection = await fetch(`cache/udelShort.json`)
        .then(res => res.ok ? res.json() : [])
        .then(records => {
            let e = new CustomEvent("dla-information-success", { "detail:" { "records": records }, "bubbles": true })
            document.dispatchEvent(e)
            return records
        })
        .catch(err=> {
            console.error(err)
            let e = new CustomEvent("tpen-information-failure", { "detail": { "err": err }, "bubbles": true })
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
        case "parsedStatus":
            statusString = "<span class='statusString good'>Parsed</span>"
            proj.pages.forEach(page => {
                if(page.numParsedLines < 5){
                    statusString = "<span title='See "+page.page_name+"' class='statusString bad'>Not Parsed</span>"
                    return
                }
            })
            el =
            `<dt class="statusLabel" title="Check if there are more than 5 lines with width > 0"> TPEN Project Parsed </dt>
             <dd class="statusValue">${statusString}</dd>
            `                               
        break
        case "assignedStatus":
            statusString = `<span class='statusString bad'>Not Assigned</span>`
            if(proj.assignees.length > 2){
                statusString = `<span class='statusString good'>Assigned to ${proj.assignees.length} users </span>`
            }
            el =
            `<dt class="statusLabel" title="Check if it is assigned to at least 1 user"> TPEN Project Assigned </dt>
             <dd class="statusValue">${statusString}</dd>
            `   
        break
        case "transcribedStatus":
            statusString = "<span class='statusString good'>Transcribed</span>"
            proj.pages.forEach(page => {
                //We really need to think about this one.
                if(page.numTranscribedLines < 5){
                    statusString = "<span title='See "+page.page_name+"' class='statusString bad'>Not Transcribed</span>"
                    return
                }
            })
            el =
            `<dt class="statusLabel" title="Check if there are more than 5 lines with width > 0 that have text on each page"> TPEN Project Transcribed </dt>
             <dd class="statusValue">${statusString}</dd>
            `   
        break
        case "finalizedStatus":
            statusString = "<span class='statusString bad'>Not Finalized</span>"
            if(proj.finalized === "true"){
                statusString = "<span class='statusString good'>Finalized</span>"
            }
            el =
            `<dt class="statusLabel" title="If there are more than 5 parsed lines on each page, and every line contains text.  Logic performed in servlet and returns T/F."> TPEN Project Finalized </dt>
             <dd class="statusValue">${statusString}</dd>
            `   
        break
        case "TPENLinkStatus":
            linkingAnnos = await fetchQuery({"type":"Annotation", "tpenProject":""+proj.id})
            statusString = "<span class='statusString bad'>No Linked Record</span>"
            if(linkingAnnos.length>0){
                statusString = "<span class='statusString good'> "+linkingAnnos.length+" Linked Record(s)</span>"
            }
            el =
            `<dt class="statusLabel" title=""> Linked to UDel Data </dt>
             <dd class="statusValue">${statusString}</dd>
            `   
        break
        case "describedStatus":
            //This T-PEN project would have to be linked to a UDEL record
            //That linking annotation has a target
            //If it is described, other annos will target that same target
            //Check how many annos target, and define the good/bad threshold. 

            //So there are some testing ones around.  Look for tpenProject.
            linkingAnnos = await fetchQuery({"type":"Annotation", "tpenProject":""+proj.id})
            describingAnnos = []
            if(linkingAnnos.length > 0){
                describingAnnos = await fetchQuery({"type":"Annotation", "target":linkingAnnos[0].target})
            }
            //Grabbing to anno.targets will tell you what handle
            statusString = "<span class='statusString bad'>Not Described</span>"
            if(describingAnnos.length>0){
                statusString = "<span class='statusString good'>There are "+describingAnnos.length+" descriptive annotations</span>"
            }
            el =
            `<dt class="statusLabel" title=""> Well Described </dt>
             <dd class="statusValue">${statusString}</dd>
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
        case "TPENProjectCreated":
            //Can we match a T-PEN project to this record?
            statusString = "<span class='statusString bad'>No TPEN Project Created</span>"
            let found = await matchTranscriptionRecords(item)
            if(found.length > 0){
                statusString = "<span title='"+found.join()+"' class='statusString good'>"+found.length+" TPEN Projects Found</span>"
            }
            el =
            `<li which="${status}">
                <label class="statusLabel"> TPEN Transcription Project Created </label>
                <div class="statusValue">${statusString}</div>
            </li>`
        break
        case "TPENProjectLinked":
            const tpenProjectKeyWildcard = {$exists: true, $type: 'string', $ne: ''}
            statusString = "<span class='statusString bad'>No TPEN Link</span>"
            let tpenProjectLinkingAnnos = await fetchQuery({"type":"Annotation", "target":udelHandlePrefix+item.handle, "body.tpenProject":tpenProjectKeyWildcard})
            let tpenProjectIDs = []
            if(tpenProjectLinkingAnnos.length > 0){
                for(tpenAnno of tpenProjectLinkingAnnos){
                    tpenProjectIDs.push(tpenProjectLinkingAnnos.body.tpenProject)
                }
                statusString = "<span title='See "+tpenProjectIDs.join()+"' class='statusString good'>Found TPEN Project Link(s)</span>"
            }
            el =
            `<li which="${status}">
                <label class="statusLabel"> T-PEN Project Linked Status </label>
                <div class="statusValue">${statusString}</div>
            </li>`
        break
        case "envelopeLinked":
            //This is probably a T-PEN check, not sure. Can we check for an annotation with body that is a certain name or a primitive name of some kind?
            statusString = "<span class='statusString good'>Under Development!</span>"
            el =
            `<li which="${status}">
                <label class="statusLabel"> Item Envelope </label>
                <div class="statusValue">${statusString}</div>
            </li>`
        break
        case "uDelLinked":
            statusString = "<span class='statusString bad'>Record Not Linked</span>"
            let recordHandleAnnos2 = await fetchQuery({"type":"Annotation", "body.source.value":udelHandlePrefix+item.handle})
            if(recordHandleAnnos2.length > 0){
                statusString = "<span title='See "+recordHandleAnnos2[0].target+"' class='statusString good'>Record Linked</span>"
            }
            el =
            `<li which="${status}">
                <label class="statusLabel"> RERUM Record Linked Status </label>
                <div class="statusValue">${statusString}</div>
            </li>`
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
    return fetch("http://tinydev.rerum.io/app/query", {
        method: 'POST',
        mode: 'cors',
        body: JSON.stringify(queryObj)
    })
    .then(res => res.ok ? res.json() : Promise.reject(res))
}

/**
 *  You have a DLA Item F-Code known from a project ID.  Get the DLA record(s) that have a matching F-Code in their metadata.
 * */
async function findUdelRecordWithCode(Fcode, projID) {
    // This is the Fcode that the TPEN project knew, like F158
    // Need to check that there is a udel item with this Fcode, looking through letters collection.
    const getFolderFromMetadata = (metaMap) => {
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
    let match = false
    let impossible = false;
    let itemHandle = ""
    for(item of dlaCollection.items){
        const metadataUri = `http://tinypaul.rerum.io/dla/proxy?url=${udelHandlePrefix+item.handle}?expand=metadata`    
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
    const metadataUri = `http://tinypaul.rerum.io/dla/proxy?url=${udelHandlePrefix+dlaRecord.handle}?expand=metadata`
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
    let dlaItems = dlaCollection.items
    dlaAreaElem.innerHTML = `
        <div id="DLADocuments" class="grow wrap">list loading</div>
        <div class="sidebar">
            <h3>Refine Results <button role="button" id="dlaQueryReset">clear all</button></h3>
            <progress value="107" max="107">107 of 107</progress>
            <input id="query" type="text" placeholder="type to filter">
            <section id="dlaFacetFilter"></section>
        </div>
    `

    const DLA_FIELDS = [
        "Name", "Item Handle", "Item ID"
        //"Author", "Subjects", "Publisher", "Language", 
        //"Date Issued", "Box ID", "Number of Pages",
        //"Collection ID", "Unique ID"
        // script, decoration, physical description
    ]

    const DLA_FILTERS = {
        Status: "statuses"
    }


    const DLA_SEARCH =[
        "Title", "Physical Description", "Note(s)", "Region",
        "Topic", "Subject", "Repository", "Call Number", "Is Part Of"
    ]

    const statusesToFind = [
        "uDelLinked",
        "TPENProjectCreated",
        "TPENProjectLinked",
        "envelopeLinked"
    ]

    let listOfDLAItems = dlaItems.reduce(async function(a, b){
        let statusListElements = ``
        let statusListAttributes = new Array()
        for(status of statusesToFind){
            let el = await generateDLAStatusElement(status, b)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        a += `
        <div class="dlaRecord record" data-id="${TPproxy+udelIdPrefix+b.id}?expand=metadata" statuses="${statusListAttributes.join(' ')}">
            <h4><a href="${udelIdPrefix+b.id}">${b.name}</a></h4>
            <ul>
                ${statusListElements}
            </ul>
        </div>`}, ``)

    dlaAreaElem.innerHTML = listOfDLAItems

    dlaRecords = document.querySelectorAll(".dlaRecord")
    let dla_facets = {}
    let dla_loading = []

    Array.from(dlaRecords).forEach(r => {
        const url = r.getAttribute("data-id")
        let dl = ``
        dla_loading.push(fetch(url)
            .then(status => { if (!status.ok) { throw Error(status) } return status })
            .then(response => response.json())
            .then(manifest => {
                let metadataMap = new Map()
                manifest.metadata?.forEach(dat => {
                    metadataMap.set(dat.label, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                    if (DLA_FIELDS.includes(dat.label)) {
                        dl += `<dt>${dat.label}</dt><dd>${metadataMap.get(dat.label)}</dd>`
                    }
                    if (DLA_FILTERS[dat.label]) {
                        r.setAttribute("data-" + DLA_FILTERS[dat.label], metadataMap.get(dat.label))
                        let values = (Array.isArray(dat.value)) ? dat.value : [dat.value]
                        if (!dla_facets[DLA_FILTERS[dat.label]]) {
                            dla_facets[DLA_FILTERS[dat.label]] = new Set()
                        }
                        for (const v of values) {
                            dla_facets[DLA_FILTERS[dat.label]] = dla_facets[DLA_FILTERS[dat.label]].add(v.replace(/\?/g, ""))
                        }
                    }
                })
                r.setAttribute("data-query", DLA_SEARCH.reduce((a, b) => a += (metadataMap.has(b) ? metadataMap.get(b) : "*") + " ", ""))
                r.querySelector("dl").innerHTML = dl
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
    let tpenAreaElem = document.getElementById("tpen_browsable")
    tpenAreaElem.innerHTML = `
        <div id="TPENDocuments" class="grow wrap">list loading</div>
        <div class="sidebar">
            <h3>Refine Results <button role="button" id="tpenQueryReset">clear all</button></h3>
            <progress value="107" max="107">107 of 107</progress>
            <input id="tpen_query" type="text" placeholder="type to filter">
            <section id="tpenFacetFilter"></section>
        </div>
    `
    const TPEN_FIELDS = [
        "title", "subtitle", "subject", "date", "language",
        "author", "description", "location"
    ]

    const TPEN_FILTERS = {
        Status: "status"
    }

    // const TPEN_FILTERS = {
    //     parsedStatus: "false", assignedStatus: "false", transcribedStatus:"false",
    //     finalizedStatus: "false", TPENLinkStatus:"false", describedStatus:"false"
    // }

    const TPEN_SEARCH = [
        "title", "subtitle", "subject", "date", "language",
        "author", "description", "location"
    ]

    const statusesToFind = [
        "parsedStatus",
        "assignedStatus",
        "transcribedStatus",
        "finalizedStatus",
        "TPENLinkStatus",
        "describedStatus"
    ]

    document.getElementById("TPENDocuments").innerHTML = ""
    let TPENProjectListElem = ``
    for(proj of tpenProjects){
        //Each thing will have this suite of statuses to check for
        //These are in the tpen objects
        let statusListElements = ``
        let statusListAttributes = new Array()
        for(status of statusesToFind){
            let el = await generateProjectStatusElement(status, proj)
            if(el.indexOf("statusString good")>-1){
                statusListAttributes.push(status)
            }
            statusListElements += el
        }
        document.getElementById("TPENDocuments").innerHTML += `
            <div class="tpenRecord record" data-id="${tpenProjectPrefix+proj.id}" data-status="${statusListAttributes.join(" ")}">
            <h3><a href="${tpenProjectPrefix+proj.id}">${proj["metadata_name"]}</a></h3>
            <div class="row">
                <dl>
                </dl>
            </div>
            <div class="row">
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
    statusSet.add("parsedStatus")
    statusSet.add("assignedStatus")
    statusSet.add("transcribedStatus")
    statusSet.add("finalizedStatus")
    statusSet.add("TPENLinkStatus")
    statusSet.add("describedStatus")
    let tpen_facets = {
        "status":statusSet
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
                    metadataMap.set(dat.label, Array.isArray(dat.value) ? dat.value.join(", ") : dat.value)
                    if (TPEN_FIELDS.includes(dat.label)) {
                        //dl += `<dt>${dat.label}</dt><dd>${metadataMap.get(dat.label)}</dd>`// many of these are blank...
                        if(metadataMap.get(dat.label).trim() !== ""){
                            dl += `<dt>${dat.label}</dt><dd>${metadataMap.get(dat.label)}</dd>`
                        }
                    }
                })
                //Here we aren't filtering by metadata.  We are filtering by statuses, it is the only facet and is set above
                r.setAttribute("data-query", TPEN_SEARCH.reduce((a, b) => a += (metadataMap.has(b) ? metadataMap.get(b) : "*") + " ", ""))
                r.querySelector("dl").innerHTML = dl
            })
            .catch(err => { throw Error(err) })
        )
    })
    document.getElementById("tpen_query").addEventListener("input", filterQuery)
    return Promise.all(tpen_loading).then(() => populateSidebar(tpen_facets, TPEN_FILTERS, "tpen")).catch(err=>console.error(err))
}

function populateSidebar(facets, filters, which) {
    //The facet needs to be <facet data-facet="status" data-label="parsedStatus" data-count="1"> for each status to filter by.
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