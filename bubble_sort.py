def bubble_sort(arr):
    """使用冒泡排序对列表进行升序排序（原地排序）。"""
    n = len(arr)
    for i in range(n - 1):
        swapped = False
        for j in range(n - 1 - i):
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                swapped = True
        if not swapped:
            break
    return arr


if __name__ == "__main__":
    numbers = [64, 34, 25, 12, 22, 11, 90]
    print("排序前:", numbers)
    bubble_sort(numbers)
    print("排序后:", numbers)
