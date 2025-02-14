/**
 * @module
 * This library provides a collection wrapper for PouchDB documents validated by Zod schemas.
 */
import type {z, ZodString} from 'zod'
import pouchDB from 'pouchdb'

/** A strongly-typed collection wrapper for PouchDB documents validated by Zod schemas. */
export class Collection<T extends z.ZodSchema> {
    /** Create a new typed collection instance.
     * @param database - The PouchDB database instance to operate on
     * @param collectionName - A unique identifier for this collection, used to segregate documents
     * @param schema - A Zod schema that defines the structure and validation of documents in this collection
     */
    constructor(
        private database: PouchDB.Database,
        private collectionName: string,
        private schema: T,
    ) {}

    /**
     * Store a document in the database after validating it against the collection's schema.
     * Automatically adds collection metadata to the document.
     * @param data - The document data to store, must conform to the collection's schema
     * @param options - Additional options to pass to PouchDB's `put` method
     * @returns A promise that resolves to the result of the `put` operation
     * @throws Will throw if the document fails schema validation
     */
    async put(data: z.input<T>, options: PouchDB.Core.PutOptions = {}): Promise<PouchDB.Core.Response> {
        const doc = this.schema.parse(data)
        doc.$collection = this.collectionName
        return await this.database.put(doc, options)
    }

    /**
     * Update an existing document
     * @param data - The document data to store, must conform to the collection's schema
     * @param options - Additional options to pass to PouchDB's `put` method
     * @returns A promise that resolves to the result of the `put` operation
     * @throws Will throw if the data fails schema validation or the document doesn't exist
     */
    async update(data: z.input<T>, options: PouchDB.Core.PutOptions = {}): Promise<PouchDB.Core.Response> {
        const doc = this.schema.parse(data)
        const existing = await this.database.get(doc._id)
        doc.$collection = this.collectionName
        doc._rev = existing._rev
        return await this.database.put(doc, options)
    }

    /**
     * Retrieve all documents belonging to this collection.
     * Each document is validated against the collection's schema before being returned.
     * @param options - The find request options following PouchDB.Find
     * @returns A promise that resolves to an array of validated documents
     * @throws Will throw if any retrieved documents fail schema validation
     */
    async find(
        options?: Omit<PouchDB.Find.FindRequest<{}>, 'selector'> & {
            selector?: Partial<Record<keyof z.infer<T>, any>>
        },
    ): Promise<z.infer<T>[]> {
        if (options?.fields) options.fields = [...options.fields, '_id', '_rev']
        const {docs} = await this.database.find({
            ...options,
            selector: {
                ...options?.selector,
                $collection: this.collectionName,
            },
        })
        return docs.map((doc) => this.schema.parse(doc))
    }

    /**
     * Retrieves a single document by its ID and validates it against the collection's schema.
     * @param id - The unique identifier of the document to retrieve
     * @param options - Additional options to pass to PouchDB's `get` method
     * @returns A promise that resolves to the validated document
     * @throws Will throw if the document doesn't exist or fails schema validation
     */
    async findById(id: string, options: PouchDB.Core.GetOptions = {}): Promise<z.infer<T>> {
        const doc = await this.database.get(id, options)
        return this.schema.parse(doc)
    }

    /**
     * Delete a document by its ID.
     * @param id - The unique identifier of the document to delete
     * @returns A promise that resolves when the document is deleted
     * @throws Will throw if the document doesn't exist
     */
    async removeById(id: string): Promise<void> {
        const doc = await this.database.get(id)
        this.database.remove(doc)
    }
}
