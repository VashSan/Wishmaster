
import * as os from "os";
import * as tmp from "tmp";
import * as rmdir from "rimraf";
import * as fs from "fs";

import { mocked } from "jest-mock";
import { IFileSystem, FileSystem } from "..";

import * as path from "path";


describe('path functions', () => {

    // jest.mock('path');
    // const pathMock = mocked(path, true);

    test('joinPaths', () => {
        const file = new FileSystem() as IFileSystem;

        let pathA = "/test";
        let pathB = "B/C";

        let result = file.joinPaths(pathA, pathB);
        if (process.platform == "win32") {
            expect(result.toLowerCase()).toBe(`c:\\test\\b\\c`);
        } else {
            expect(result.toLowerCase()).toBe(`/test/b/c`);
        }

    });
});

describe('file functions', () => {
    test('file exists', () => {
        const file = new FileSystem() as IFileSystem;
        const existingFile = tmp.fileSync();
        const result = file.exists(existingFile.name);
        existingFile.removeCallback();

        expect(result).toBe(true);
    });

    test('file does not exists', () => {
        const fileReader = new FileSystem() as IFileSystem;
        const missingFile = tmp.tmpNameSync();
        const result = fileReader.exists(missingFile);

        expect(result).toBe(false);
    });

    test('read all', () => {
        // Arrange
        const file = new FileSystem() as IFileSystem;
        const existingFile = tmp.fileSync();
        const testData = "ABC123";
        fs.writeFileSync(existingFile.name, testData);

        // Act
        const result = file.readAll(existingFile.name);
        existingFile.removeCallback();

        // Assert
        expect(result).toBe(testData);
    });

    test('write all', () => {
        // Arrange
        const file = new FileSystem() as IFileSystem;
        const existingFile = tmp.fileSync();
        const testData = "ABC123";
        
        // Act
        file.writeAll(existingFile.name, testData);
        existingFile.removeCallback();

        // Assert
        let buffer: Buffer = fs.readFileSync(existingFile.name);
        let result = buffer.toString();

        expect(result).toBe(testData);
    });
});