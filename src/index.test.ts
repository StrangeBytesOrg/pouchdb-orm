import {expect, test, describe, beforeEach, afterEach} from 'bun:test'
import {z} from 'zod'
import PouchDB from 'pouchdb'
import adapterMemory from 'pouchdb-adapter-memory'
import find from 'pouchdb-find'
import {Collection} from './index'

PouchDB.plugin(find)
PouchDB.plugin(adapterMemory)

const BaseSchema = z.object({
    _id: z.string(),
    _rev: z.string().optional(),
})
const UserSchema = BaseSchema.extend({
    name: z.string(),
})

describe('PouchORM', () => {
    let pouchDb: PouchDB.Database

    beforeEach(async () => {
        // Create a fresh in-memory database for each test
        pouchDb = new PouchDB('test', {adapter: 'memory'})
    })
    afterEach(async () => {
        // Destroy the database after each test
        await pouchDb.destroy()
    })

    describe('initialization', () => {
        test('create collection with valid db and schema', () => {
            expect(() => new Collection(pouchDb, 'users', UserSchema)).not.toThrow()
        })
    })

    describe('document creation', () => {
        test('create document with valid data', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const {ok} = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(ok).toBe(true)
        })

        test('reject invalid document', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            expect(
                userCollection.put({
                    _id: 'john-doe',
                    // @ts-expect-error Intentionally invalid name
                    name: 69,
                }),
            ).rejects.toThrow()

            expect(
                // @ts-expect-error Intentionally missing _id
                userCollection.put({
                    name: 'John Doe',
                }),
            ).rejects.toThrow()
        })

        test('reject with an invalid schema', async () => {
            const BadSchema = z.object({
                foo: z.string(),
            })
            const userCollection = new Collection(pouchDb, 'users', BadSchema)
            expect(
                userCollection.put({
                    foo: 'bar',
                }),
            ).rejects.toThrowError('_id is required for puts')
        })

        test('return an id and rev on create', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const {id, rev} = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(id).toBeDefined()
            expect(rev).toBeDefined()
            expect(id).toBeString()
            expect(rev).toBeString()
        })

        test('automatically add $collection to document', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const {id, rev} = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            const doc = await pouchDb.get(id)
            // @ts-expect-error PouchDB doesn't have types for the $collection property
            expect(doc.$collection).toBe('users')
        })
    })

    describe('document fetching', () => {
        test('return all documents with the same $collection', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })
            await userCollection.put({
                _id: 'jane-doe',
                name: 'Jane Doe',
            })

            const users = await userCollection.find()
            expect(users).toBeArray()
            expect(users).toHaveLength(2)
            expect(users[0]._id).toBe('jane-doe')
            expect(users[1]._id).toBe('john-doe')
        })

        test('return document by id', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })
            await userCollection.put({
                _id: 'jane-doe',
                name: 'Jane Doe',
            })

            const user = await userCollection.findById('john-doe')
            expect(user._id).toBe('john-doe')
            expect(user.name).toBe('John Doe')
        })

        test('throw when document not found', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(userCollection.findById('jane-doe')).rejects.toThrowError('missing')
        })

        test('does not return documents from other collections', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)
            const OtherSchema = BaseSchema.extend({other: z.string()})
            const otherCollection = new Collection(pouchDb, 'other', OtherSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })
            await otherCollection.put({
                _id: 'new-thing',
                other: 'thing',
            })

            const users = await userCollection.find()
            expect(users).toHaveLength(1)
            expect(users[0]._id).toBe('john-doe')
        })
    })

    describe('document updating', () => {
        test('update an existing document using "put" when _rev is supplied', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const {id, rev} = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            const {id: updateId, rev: updateRev} = await userCollection.put({
                _id: id,
                _rev: rev,
                name: 'Something Else',
            })
            expect(updateRev).not.toBe(rev)
            expect(updateRev).toStartWith('2-')
            expect(updateId).toBe(id)
        })

        test('adds $collection to document on update', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const {id, rev} = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            await userCollection.update({
                _id: id,
                _rev: rev,
                name: 'Something Else',
            })

            const doc = await pouchDb.get(id)
            // @ts-expect-error PouchDB doesn't have types for the $collection property
            expect(doc.$collection).toBe('users')
        })

        test('reject put when _rev is missing', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(
                userCollection.put({
                    _id: 'john-doe',
                    name: 'John Doe',
                }),
            ).rejects.toThrowError('Document update conflict')
        })

        test('update an existing document using "update"', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })
            const {ok} = await userCollection.update({
                _id: 'john-doe',
                name: 'Something Else',
            })

            expect(ok).toBe(true)
        })

        test('throw when document not found for update', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            expect(
                userCollection.update({
                    _id: 'john-doe',
                    name: 'Something Else',
                }),
            ).rejects.toThrowError('missing')
        })
    })

    describe('document deletion', () => {
        test('delete document by id', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            await userCollection.removeById('john-doe')

            expect(userCollection.findById('john-doe')).rejects.toThrowError('missing')
        })

        test('throw when document not found for deletion', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(userCollection.removeById('jane-doe')).rejects.toThrowError('missing')
        })
    })
})
