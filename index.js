import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
const client = new DeliverooApi(
    'http://localhost:8080',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA5ZmQ2NDllNzZlIiwibmFtZSI6Im1hcmNvIiwiaWF0IjoxNjc5OTk3Njg2fQ.6_zmgL_C_9QgoOX923ESvrv2i2_1bgL_cWjMw4M7ah4'
)

class Parcel {
    constructor(id, x, y, carriedBy, reward) {

        this.id = id
        this.x = x
        this.y = y,
            this.carriedBy = carriedBy,
            this.reward = reward
    }
}

class Agent {

    constructor(id, name, x, y, score) {

        this.id = id,
            this.name = name,
            this.x = x,
            this.y = y,
            this.score = score
    }
}

class GameMap {
    constructor(width, height, tiles) {
        this.width = width
        this.height = height
        this.tiles = tiles
    }
}

var me = new Agent()

var map = new GameMap()

var deliveryTiles = []

var parcels = new Map()

client.onYou(({ id, name, x, y, score }) => {
    me = new Agent(id, name, x, y, score)
    console.log("onyou called")
})

await client.onMap((width, height, tiles) => {
    console.log("Getting map info: ")
    console.log("Width:" + width)
    map = new GameMap(width, height, tiles)
    tiles.forEach(e => {
        if (e.delivery) {
            deliveryTiles.push(e)
        }
    });
    console.log(map.tiles)
})

client.onParcelsSensing(async (detectedParcels) => {

    detectedParcels.forEach(async p => {
        //if(!parcels.has(p.id)){
        parcels.set(p.id, p)
    })

    //If no more in the detected parcel, remove the parcel from the list
    for (const [id, p] of parcels.entries()) {
        if (!detectedParcels.find(p => p.id == id)) {
            parcels.delete(id);
            me.carrying.delete(id);
        }
    }
})

/**
 * Intention
 */

class Intention {

    // Plan currently used for achieving the intention 
    #current_plan;

    // This is used to stop the intention
    #stopped = false;
    get stopped() {
        return this.#stopped;
    }
    stop() {
        // this.log( 'stop intention', ...this.#predicate );
        this.#stopped = true;
        if (this.#current_plan)
            this.#current_plan.stop();
    }

    /**
     * #parent refers to caller
     */
    #parent;

    /**
     * predicate is in the form ['go_to', x, y]
     */
    get predicate() {
        return this.#predicate;
    }
    #predicate;

    constructor(parent, predicate) {
        this.#parent = parent;
        this.#predicate = predicate;
    }

    log(...args) {
        if (this.#parent && this.#parent.log)
            this.#parent.log('\t', ...args)
        else
            console.log(...args)
    }

    #started = false;
    /**
     * Using the plan library to achieve an intention
     */
    async achieve() {
        // Cannot start twice
        if (this.#started)
            return this;
        else
            this.#started = true;

        // Trying all plans in the library
        for (const planClass of planLibrary) {

            // if stopped then quit
            if (this.stopped)
                break;

            // if plan is 'statically' applicable
            if (planClass.isApplicableTo(...this.predicate)) {
                // plan is instantiated
                this.#current_plan = new planClass(this.parent);
                // this.log('achieving intention', ...this.predicate, 'with plan', planClass.name);
                // and plan is executed and result returned
                try {
                    const plan_res = await this.#current_plan.execute(...this.predicate);
                    this.log('succesful intention', ...this.predicate, 'with plan', planClass.name, 'with result:', plan_res);
                    return plan_res
                    // or errors are caught so to continue with next plan
                } catch (error) {
                    if (this.stopped)
                        break;
                    this.log('failed intention', ...this.predicate, 'with plan', planClass.name, 'with error:', error);
                }
            }

        }

        // if stopped then quit
        if (this.stopped) throw ['stopped intention', ...this.predicate];

        // no plans have been found to satisfy the intention
        // this.log( 'no plan satisfied the intention ', ...this.predicate );
        throw ['no plan satisfied the intention ', ...this.predicate]
    }

}

/**
* Plan library
*/
const planLibrary = [];

class Plan {

    // This is used to stop the plan
    #stopped = false;
    stop() {
        // this.log( 'stop plan' );
        this.#stopped = true;
        for (const i of this.#sub_intentions) {
            i.stop();
        }
    }
    get stopped() {
        return this.#stopped;
    }

    /**
     * #parent refers to caller
     */
    #parent;

    constructor(parent) {
        this.#parent = parent;
    }

    log(...args) {
        if (this.#parent && this.#parent.log)
            this.#parent.log('\t', ...args)
        else
            console.log(...args)
    }

    // this is an array of sub intention. Multiple ones could eventually being achieved in parallel.
    #sub_intentions = [];

    async subIntention(predicate) {
        const sub_intention = new Intention(this, predicate);
        this.#sub_intentions.push(sub_intention);
        return sub_intention.achieve();
    }

}


//Plans
//////////////////////////////////////////


class GoToParcel extends Plan {

    static isApplicableTo(go_to_parcel, x, y, id) {
        return go_to_parcel == 'go_to_parcel';
    }

    async execute(go_to_parcel, x, y) {
        if (this.stopped) throw ['stopped']; // if stopped then quit
        await this.subIntention(['go_to', x, y]);
        if (this.stopped) throw ['stopped']; // if stopped then quit
        await client.pickup()
        if (this.stopped) throw ['stopped']; // if stopped then quit
        return true;
    }

}


class BFSOptimalPath extends Plan {

    static isApplicableTo(go_to, x, y) {
        return go_to == 'go_to';
    }

    async execute(go_to, x, y) {

        while (me.x != x || me.y != y) {
            const actions = getOptimalPath(map.width, map.height, me.x, me.y, x, y, map.tiles);

            if (actions == null) {
                throw 'can not find any path'
            }

            for (var action of actions){

                if (this.stopped) throw ['stopped']; // if stopped then quit
              
                const status = await client.move(action)

                if (status) {
                    me.x = status.x;
                    me.y = status.y;
                }
                else {
                    this.log('DepthSearchMove replanning', 'from', me.x, me.y, 'to', { x, y });
                    break;
                }

            }

        }

        return true;
    }


}


class Patrolling extends Plan {

    static isApplicableTo ( patrolling ) {
        return patrolling == 'patrolling';
    }

    async execute ( patrolling ) {
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        let i = Math.round( Math.random() * map.tiles.size );
        let tile = Array.from( map.tiles.values() ).at( i );
        if ( tile )
            await this.subIntention( ['go_to', tile.x, tile.y] );
        if ( this.stopped ) throw ['stopped']; // if stopped then quit
        return true;
    }

}


planLibrary.push(GoToParcel)
planLibrary.push(BFSOptimalPath)
planLibrary.push(Patrolling)


///////////////////////////////////////////


/**
 * Intention revision loop
 */
class IntentionRevision {

    #intention_queue = new Array();
    get intention_queue() {
        return this.#intention_queue;
    }

    currentIntention;

    stopCurrent() {
        if (this.currentIntention)
            this.currentIntention.stop();
    }

    async loop() {
        while (true) {
            // Consumes intention_queue if not empty
            if (this.intention_queue.length > 0) {
                console.log('intentionRevision.loop', this.intention_queue);

                // Current intention
                const predicate = this.intention_queue.shift();
                const intention = this.currentIntention = new Intention(this, predicate);

                // Is queued intention still valid? Do I still want to achieve it?
                // TODO this hard-coded implementation is an example
                if (intention.predicate[0] == "go_to_parcel") {
                    let highestReward = 0
                    let targetParcel
                    for (const [id, p] of parcels.entries()) {
                        if(p.id>highestReward)
                            targetParcel = p
                    }
                    intention.predicate[1] = targetParcel.x
                    intention.predicate[2] = targetParcel.y
                    let id = intention.predicate[3]
                    let p = parcels.get(id)
                    if (p && p.carriedBy) {
                        console.log('Skipping intention because no more valid', intention.predicate);
                        continue;
                    }
                }

                // Start achieving intention
                await intention.achieve()
                    // Catch eventual error and continue
                    .catch(error => {
                        if (!intention.stopped)
                            console.error('Failed intention', ...intention.predicate, 'with error:', error)
                    });

            }
            else {
                this.push(this.idle);
            }

            // Postpone next iteration at setImmediate
            await new Promise(res => setImmediate(res));
        }
    }

    // async push ( predicate ) { }

    log(...args) {
        console.log(...args)
    }

    async push(predicate) {

        // console.log( 'IntentionRevisionReplace.push', predicate );

        // // Check if already queued
        // if ( this.intention_queue.find( (p) => p.join(' ') == predicate.join(' ') ) )
        //     return;

        // // Reschedule current
        // if ( this.currentIntention )
        //     this.intention_queue.unshift( this.currentIntention.predicate );

        // Prioritize pushed one
        this.intention_queue.unshift(predicate);

        // Force current to stop
        this.stopCurrent();

    }

}

/**
 * Start intention revision loop
 */

// const myAgent = new IntentionRevisionQueue();
const myAgent = new IntentionRevision();
myAgent.idle = ["patrolling"];
// const myAgent = new IntentionRevisionRevise();
myAgent.loop();


////////


function getOptimalPath(dimensionX, dimensionY, startX, startY, endX, endY, validTiles) {
    // Create a grid to represent the valid tiles
    const grid = [];
    for (let y = 0; y < dimensionY; y++) {
        grid[y] = [];
        for (let x = 0; x < dimensionX; x++) {
            grid[y][x] = null;
        }
    }

    // Mark valid tiles in the grid
    for (const tile of validTiles) {
        const { x, y } = tile;
        grid[y][x] = tile;
    }

    // Define the movements (up, down, left, right)
    const movements = [
        { dx: 0, dy: 1, action: 'up' },
        { dx: 0, dy: -1, action: 'down' },
        { dx: -1, dy: 0, action: 'left' },
        { dx: 1, dy: 0, action: 'right' }
    ];

    // Create a queue for BFS traversal
    const queue = [{ x: startX, y: startY, path: [] }];

    // Create a visited set to track visited tiles
    const visited = new Set();

    // Perform BFS
    while (queue.length > 0) {
        const { x, y, path } = queue.shift();

        // Check if the current tile is the destination
        if (x === endX && y === endY) {
            return path;
        }

        // Check valid movements from the current tile
        for (const { dx, dy, action } of movements) {
            const newX = x + dx;
            const newY = y + dy;

            // Check if the new position is within the grid boundaries
            if (newX >= 0 && newX < dimensionX && newY >= 0 && newY < dimensionY) {
                const nextTile = grid[newY][newX];

                // Check if the new position is a valid tile and not visited before
                if (nextTile && !visited.has(`${newX},${newY}`)) {
                    visited.add(`${newX},${newY}`);
                    queue.push({
                        x: newX,
                        y: newY,
                        path: [...path, action]
                    });
                }
            }
        }
    }

    // If no path is found, return null
    return null;
}
