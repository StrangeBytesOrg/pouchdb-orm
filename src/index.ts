/**
 * @module
 * This library provides a collection wrapper for PouchDB documents validated by Zod schemas.
 */
import type {z, ZodString} from 'zod'
import type pouchDB from 'pouchdb'

/** A strongly-typed collection wrapper for PouchDB documents validated by Zod schemas. */
export class Collection<T extends z.ZodSchema> {
    /** Creates a new typed collection instance.
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
     * Stores a document in the database after validating it against the collection's schema.
     * Automatically adds collection metadata to the document.
     *
     * @param data - The document data to store, must conform to the collection's schema
     * @returns A promise that resolves to the validated document with its revision ID
     * @throws Will throw if the document fails schema validation
     */
    async put(data: z.input<T>): Promise<z.infer<T>> {
        const doc = this.schema.parse(data)
        doc.$collection = this.collectionName
        const {rev} = await this.database.put(doc)
        doc._rev = rev
        return doc
    }

    /**
     * Retrieves all documents belonging to this collection.
     * Each document is validated against the collection's schema before being returned.
     *
     * @returns A promise that resolves to an array of validated documents
     * @throws Will throw if any retrieved documents fail schema validation
     */
    async find(): Promise<z.infer<T>[]> {
        const {docs} = await this.database.find({
            selector: {
                $collection: this.collectionName,
            },
        })
        return docs.map((doc) => this.schema.parse(doc))
    }

    /**
     * Retrieves a single document by its ID and validates it against the collection's schema.
     *
     * @param id - The unique identifier of the document to retrieve
     * @returns A promise that resolves to the validated document
     * @throws Will throw if the document doesn't exist or fails schema validation
     */
    async findById(id: string): Promise<z.infer<T>> {
        const doc = await this.database.get(id)
        return this.schema.parse(doc)
    }

    /**
     * Deletes a document by its ID.
     *
     * @param id - The unique identifier of the document to delete
     * @returns A promise that resolves when the document is deleted
     * @throws Will throw if the document doesn't exist
     */
    async removeById(id: string): Promise<void> {
        const doc = await this.database.get(id)
        this.database.remove(doc)
    }
}
