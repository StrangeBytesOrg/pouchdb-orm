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
        test('should create collection with valid db and schema', () => {
            expect(() => new Collection(pouchDb, 'users', UserSchema)).not.toThrow()
        })
    })

    describe('document creation', () => {
        test('should create document with valid data', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const user = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(user.name).toBe('John Doe')
        })

        test('should reject invalid document', async () => {
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

        test('should reject with an invalid schema', async () => {
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

        test('should return document with _rev', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const user = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(user._rev).toBeDefined()
            expect(typeof user._rev).toBe('string')
        })

        test('should update an existing document when _rev is supplied', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const user = await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })
            const updatedUser = await userCollection.put({
                _id: 'john-doe',
                _rev: user._rev,
                name: 'John Doe',
            })
            expect(updatedUser._rev).not.toBe(user._rev)
            expect(updatedUser._rev).toStartWith('2-')
        })

        test('should reject update when _rev is missing', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            const user = await userCollection.put({
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

        test('should return all documents with the same $collection', async () => {
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

        test('should return document by id', async () => {
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

        test('should throw when document not found', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(userCollection.findById('jane-doe')).rejects.toThrowError('missing')
        })

        test('should delete document by id', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            await userCollection.removeById('john-doe')

            expect(userCollection.findById('john-doe')).rejects.toThrowError('missing')
        })

        test('should throw when document not found for deletion', async () => {
            const userCollection = new Collection(pouchDb, 'users', UserSchema)

            await userCollection.put({
                _id: 'john-doe',
                name: 'John Doe',
            })

            expect(userCollection.removeById('jane-doe')).rejects.toThrowError('missing')
        })
    })
})
