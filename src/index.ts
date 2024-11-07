import type {z, ZodString} from 'zod'
import type pouchDB from 'pouchdb'

export class Collection<T extends z.ZodSchema> {
    constructor(
        private database: PouchDB.Database,
        private collectionName: string,
        private schema: T,
    ) {}

    async put(data: z.input<T>): Promise<z.infer<T>> {
        const doc = this.schema.parse(data)
        doc.$collection = this.collectionName
        const {rev} = await this.database.put(doc)
        doc._rev = rev
        return doc
    }

    async find(): Promise<z.infer<T>[]> {
        const {docs} = await this.database.find({
            selector: {
                $collection: this.collectionName,
            },
        })
        return docs.map((doc) => this.schema.parse(doc))
    }

    async findById(id: string): Promise<z.infer<T>> {
        const doc = await this.database.get(id)
        return this.schema.parse(doc)
    }
}
