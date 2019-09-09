const prettier = require('prettier');
const { TYPE_JSON } = require('../../dataTypes');
const babelTraverse = require('@babel/traverse').default;

function updateInlineSnapshot(testFile, actual, dataType) {
    const sourceFile = fs.readFileSync(testFile, 'utf8');

    // Resolve project configuration.
    // For older versions of Prettier, do not load configuration.
    const config = prettier.resolveConfig
        ? prettier.resolveConfig.sync(testFile, {
            editorconfig: true,
        })
        : null;

    // Detect the parser for the test file.
    const inferredParser = prettier.getFileInfo.sync(testFile).inferredParser;

    // Insert snapshots using the custom parser API. After insertion, the code is
    // formatted, except snapshot indentation. Snapshots cannot be formatted until
    // after the initial format because we don't know where the call expression
    // will be placed (specifically its indentation).
    const newSourceFile = prettier.format(sourceFile, {
        ...config,
        filepath: sourceFilePath,
        parser: createInsertionParser(snapshots, inferredParser),
    });

    // Format the snapshots using the custom parser API.
    const formattedNewSourceFile = prettier.format(newSourceFile, {
        ...config,
        filepath: sourceFilePath,
        parser: createFormattingParser(inferredParser),
    });

    if (formattedNewSourceFile !== sourceFile) {
        fs.writeFileSync(testFile, formattedNewSourceFile);
    }
}

// This parser inserts snapshots into the AST.
function createInsertionParser(
    inferredParser
) {
    // Workaround for https://github.com/prettier/prettier/issues/3150
    options.parser = inferredParser;

    const groupedSnapshots = groupSnapshotsByFrame(snapshots);
    const remainingSnapshots = new Set(snapshots.map(({ snapshot }) => snapshot));

    const ast = getAst(parsers, inferredParser, text);
    babelTraverse(ast, {
        CallExpression({ node: { arguments: args, callee } }: { node: CallExpression }) {
            if (
                callee.type !== 'MemberExpression' ||
                callee.property.type !== 'Identifier'
            ) {
                return;
            }
            const { line, column } = callee.property.loc.start;
            const snapshotsForFrame = groupedSnapshots[`${line}:${column}`];
            if (!snapshotsForFrame) {
                return;
            }
            if (snapshotsForFrame.length > 1) {
                throw new Error(
                    'Jest: Multiple inline snapshots for the same call are not supported.',
                );
            }
            const snapshotIndex = args.findIndex(
                ({ type }) => type === 'TemplateLiteral',
            );
            const values = snapshotsForFrame.map(({ snapshot }) => {
                remainingSnapshots.delete(snapshot);

                return templateLiteral(
                    [templateElement({ raw: escapeBacktickString(snapshot) })],
                    [],
                );
            });
            const replacementNode = values[0];

            if (snapshotIndex > -1) {
                args[snapshotIndex] = replacementNode;
            } else {
                args.push(replacementNode);
            }
        },
    });

    if (remainingSnapshots.size) {
        throw new Error(`Jest: Couldn't locate all inline snapshots.`);
    }

    return ast;
}

// This parser formats snapshots to the correct indentation.
function createFormattingParser(
    inferredParser
) {
    // Workaround for https://github.com/prettier/prettier/issues/3150
    options.parser = inferredParser;

    const ast = getAst(parsers, inferredParser, text);
    babelTraverse(ast, {
        CallExpression({ node: { arguments: args, callee } }: { node: CallExpression }) {
            if (
                callee.type !== 'MemberExpression' ||
                callee.property.type !== 'Identifier' ||
                callee.property.name !== 'toMatchInlineSnapshot' ||
                !callee.loc ||
                callee.computed
            ) {
                return;
            }

            let snapshotIndex: number | undefined;
            let snapshot: string | undefined;
            for (let i = 0; i < args.length; i++) {
                const node = args[i];
                if (node.type === 'TemplateLiteral') {
                    snapshotIndex = i;
                    snapshot = node.quasis[0].value.raw;
                }
            }
            if (snapshot === undefined || snapshotIndex === undefined) {
                return;
            }

            const useSpaces = !options.useTabs;
            snapshot = indent(
                snapshot,
                Math.ceil(
                    useSpaces
                        ? callee.loc.start.column / options.tabWidth
                        : callee.loc.start.column / 2, // Each tab is 2 characters.
                ),
                useSpaces ? ' '.repeat(options.tabWidth) : '\t',
            );

            const replacementNode = templateLiteral(
                [
                    templateElement({
                        raw: snapshot,
                    }),
                ],
                [],
            );
            args[snapshotIndex] = replacementNode;
        },
    });

    return ast;
};

module.exports = {
    updateInlineSnapshot
};