import json
import unittest
import time

from ocpa.objects.log.importer.ocel import factory as ocel_import_factory
from src.endpoints.pq import unique_nodes_to_query, QueryParser, QueryGraph


def execute_unique_queries(test_file_path: str, type: str):
    start_time = time.time()
    with open(test_file_path) as f:
        data = json.load(f)
        ocel = ocel_import_factory.apply(data['file_path'])
        query = {"data": data['nodes'][0]['data']['query'], 'left': None, 'right': None}
        query_obj = QueryGraph(ocel)
        binary_tree = QueryParser.from_json(query)
        binary_tree.query = query_obj

        pes, pes_idx = binary_tree.execute(ocel)

        print("Test (" + type + ") took: --- %s seconds ---" % (time.time() - start_time))
        return pes, pes_idx


class TestUniqueNodeQueries(unittest.TestCase):

    def test_contains_object_of_type(self):
        pes, pes_idx = execute_unique_queries("./src/test/object_type.json", "Object of Type")
        self.assertEqual(len(pes), 3)
        self.assertEqual(pes_idx, [0, 1, 2])

    def test_contains_objects(self):
        pes, pes_idx = execute_unique_queries("./src/test/objects.json", "Objects")
        self.assertEqual(len(pes), 4)
        self.assertEqual(pes_idx, [0, 6, 29, 40])


if __name__ == '__main__':
    unittest.main()
