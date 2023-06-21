import { DeliverooApi } from "@unitn-asa/deliveroo-js-client";
const client = new DeliverooApi(
    'http://localhost:8080',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjA5ZmQ2NDllNzZlIiwibmFtZSI6Im1hcmNvIiwiaWF0IjoxNjc5OTk3Njg2fQ.6_zmgL_C_9QgoOX923ESvrv2i2_1bgL_cWjMw4M7ah4'
)

const map = {
    width: undefined,
    height: undefined,
    tiles: []
}

class Agent {

    constructor(id, name, x, y, score) {

        this.id = id
        this.name = name
        this.x = x
        this.y = y
        this.score = score
    }
}

const me = new Agent()

const deliveryTiles = []

class Parcel {
    constructor(id, x, y, carriedBy, reward) {

        this.id = id
        this.x = x
        this.y = y
        this.carriedBy = carriedBy
        this.reward = reward
    }
}

var parcels = []

client.onMap((width, height, tiles) => {
    console.log("Getting map info: ")
    console.log("Width:" + width)
    map.width = width
    map.height = height
    tiles.forEach(e => {
        map.tiles.push(e)
        if (e.delivery) {
            deliveryTiles.push(e)
        }
    });

})

client.onYou(({ id, name, x, y, score }) => {
    me = new Agent(id, name, x, y, score)
    console.log("onyou called")
})


client.onParcelsSensing(async (detectedParcels) => {
    detectedParcels.forEach(async p => {
        await parcels.push(p)

    })


    await loop(parcels)

})



async function loop(parcels) {

    var highestScore = 0
    var targetParcel

    console.log(parcels)

    parcels.forEach(p => {
        if (p.reward > highestScore) {
            console.log("found a target parcel")
            targetParcel = new Parcel(p.id, p.x, p.y, p.carriedBy, p.reward)
        }

    });

    console.log("tagetparcel")
    console.log(targetParcel)
    console.log(me.x + " " + me.y)
    var actions = await getOptimalPath(map.width, map.height, me.x, me.y, targetParcel.x, targetParcel.y, map.tiles);

    console.log("actions " + actions)
    var flag = true


    while (me.x != targetParcel.x || me.y != targetParcel.y) {

        await actions.forEach(async a => {

            await client.move(a)
            await client.onYou(({ x, y }) => {
                me.x = x
                me.y = y
            })
        });
    }

}





//var actions = getOptimalPath(map.width, map.height,me.x, me.y, destX, destY, map.tiles);


///////////////////////////////////////////////////////////////



/*

 function agentLoop() {
    
     client.onParcelsSensing(({id, x, y, carriedBy, reward})=>{

        console.log("on parcel sensing")

        parcels.forEach(p => {
            if (p.id != id){
                var newParcel = new Parcel(id,x,y,carriedBy,reward)
                parcels.push(newParcel)
            }
            
        });

        console.log (parcels)
        
        })
        
        
  


        console.log("loop")
  
    const options = []
    for (const parcel of parcels.values())
        if ( ! parcel.carriedBy )
            options.push( { desire: 'move', args: [parcel] } );

    let best_option;
    let nearest = Number.MAX_VALUE;
    for (const option of options) {
        let current_i = option.desire
        let current_d = distance( option.args[0], me )
        if ( current_i == 'move' && current_d < nearest ) {
            best_option = option
            nearest = distance( option.args[0], me )
        }
    }

  
    if(best_option)
        myAgent.queue( best_option.desire, ...best_option.args )

}

agentLoop ()



class Agent {

    intention_queue = new Array();

    async intentionLoop ( ) {
        while ( true ) {
            const intention = this.intention_queue.shift();
            if ( intention )
                await intention.achieve();
            await new Promise( res => setImmediate( res ) );
        }
    }

    async queue ( desire, ...args ) {
        const last = this.intention_queue.at( this.intention_queue.length - 1 );
        const current = new Intention( desire, ...args )
        this.intention_queue.push( current );
    }

    async stop ( ) {
        console.log( 'stop agent queued intentions');
        for (const intention of this.intention_queue) {
            intention.stop();
        }
    }

}
const myAgent = new Agent();
myAgent.intentionLoop();


class Plan {

    stop () {
        console.log( 'stop plan and all sub intentions');
        for ( const i of this.#sub_intentions ) {
            i.stop();
        }
    }

    #sub_intentions = [];

    async subIntention ( desire, ...args ) {
        const sub_intention = new Intention( desire, ...args );
        this.#sub_intentions.push(sub_intention);
        return await sub_intention.achieve();
    }

}

class Intention extends Promise {

    #current_plan;
    stop () {
        console.log( 'stop intention and current plan');
        this.#current_plan.stop();
    }

    #desire;
    #args;

    #resolve;
    #reject;

    constructor ( desire, ...args ) {
        var resolve, reject;
        super( async (res, rej) => {
            resolve = res; reject = rej;
        } )
        this.#resolve = resolve
        this.#reject = reject
        this.#desire = desire;
        this.#args = args;
    }

    #started = false;
    async achieve () {
        if ( this.#started)
            return this;
        else
            this.#started = true;

        for (const plan of plans) {
            if ( plan.isApplicableTo( this.#desire ) ) {
                this.#current_plan = plan;
                console.log('achieving desire', this.#desire, ...this.#args, 'with plan', plan);
                try {
                    const plan_res = await plan.execute( ...this.#args );
                    this.#resolve( plan_res );
                    console.log( 'plan', plan, 'succesfully achieved intention', this.#desire, ...this.#args, 'with result', plan_res );
                    return plan_res
                } catch (error) {
                    console.log( 'plan', plan, 'failed while trying to achieve intention', this.#desire, ...this.#args, 'with error', error );
                }
            }
        }

        this.#reject();
        console.log('no plan satisfied the desire ', this.#desire, ...this.#args);
        throw 'no plan satisfied the desire ' + this.#desire;
    }

}


const plans = [];


class GoToHighestScoreParcel extends Plan {

isApplicableTo(desire) {
    return desire == "move"
}




async execute ( {parcel}){


console.log("into intention")
    console.log(actions)

destX = parcel.x
destY = parcel.y




    while(me.x!=destX && me.y!=destY){

        


    }


}

}

plans.push(GoToHighestScoreParcel);


*/
///////////////////////


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
